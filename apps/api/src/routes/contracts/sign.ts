import { createHash, randomUUID } from "node:crypto";
import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { stampContractPdf } from "~/lib/contract/pdf";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { signContractResponseSchema, signContractSchema } from "./schema";

/** Decode a "data:image/png;base64,…" URL into raw bytes. */
function pngBytesFromDataUrl(dataUrl: string): Buffer {
    const comma = dataUrl.indexOf(",");
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Buffer.from(base64, "base64");
}

export const signContractRoute = route().post(
    "/sign",
    describeRoute({
        tags: ["contracts"],
        summary: "Sign the active contract",
        operationId: "signContract",
        description: `Signs the active volunteer contract for the authenticated user.

The signature PNG is stamped onto the contract at the placement chosen when the
contract was uploaded, and the resulting PDF is stored as the signed document.
Both the signature and the signed PDF are private assets — fetch the signed PDF
via GET /api/contracts/signed-pdf, never the public asset route.

Sends email to notification contacts of all groups the user belongs to that
require contract signing.`,
    })
        .schemaResponse({
            statusCode: 201,
            schema: signContractResponseSchema,
            description: "Contract signed",
        })
        .badRequest({ description: "Invalid signature image" })
        .response({ statusCode: 409, description: "Already signed" })
        .response({
            statusCode: 422,
            description: "The active contract has no signature field placed",
        })
        .notFound({ description: "No active contract" })
        .unauthorized()
        .build(),
    requireAuth,
    validator("json", signContractSchema),
    async (c) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const body = c.req.valid("json");
        const { db, email, bucket } = c.get("ctx");
        const logger = c.get("logger");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw new HTTPException(404, {
                message: "No active contract found",
            });
        }

        // Without a placement there is nowhere to draw the signature, and the
        // signed PDF would come back looking unsigned. Refuse rather than hand
        // the member a hollow document: the contract must be re-uploaded with a
        // signature field placed on it.
        if (!activeContract.signaturePlacement) {
            throw new HTTPException(422, {
                message:
                    "The active contract has no signature field placed on it and cannot be signed",
            });
        }

        const existing = await db.query.contractSignature.findFirst({
            where: and(
                eq(schema.contractSignature.contractId, activeContract.id),
                eq(schema.contractSignature.userId, user.id),
            ),
        });

        if (existing) {
            throw new HTTPException(409, {
                message: "Contract already signed",
            });
        }

        const signaturePng = pngBytesFromDataUrl(body.signatureDataUrl);
        if (signaturePng.length === 0) {
            throw new HTTPException(400, {
                message: "Signature image is empty",
            });
        }

        const originalPdf = await bucket.download(activeContract.fileKey);
        const signedAt = new Date();
        const signerIp =
            c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const signerUa = c.req.header("user-agent") ?? null;

        let stampedPdf: Buffer;
        try {
            stampedPdf = await stampContractPdf({
                originalBytes: new Uint8Array(originalPdf),
                signaturePlacement: activeContract.signaturePlacement ?? null,
                namePlacement: activeContract.namePlacement ?? null,
                signaturePng,
                signedName: body.signedName,
                signedAt,
                signerIp,
                signerUa,
            });
        } catch (cause) {
            // A malformed PNG is the likely culprit and is the signer's input;
            // a broken source PDF would have failed at upload.
            throw new HTTPException(400, {
                message: "Could not stamp the signature onto the contract",
                cause,
            });
        }

        // Both are private: only GET /api/contracts/signed-pdf serves them.
        const keyPrefix = `contracts/${activeContract.id}/${user.id}/${randomUUID()}`;
        const signatureFileKey = `${keyPrefix}_signature.png`;
        const signedPdfKey = `${keyPrefix}_signed.pdf`;

        await bucket.upload(signatureFileKey, signaturePng, {
            originalFilename: "signature.png",
            contentType: "image/png",
            uploadedById: user.id,
            visibility: "private",
        });
        await bucket.upload(signedPdfKey, stampedPdf, {
            originalFilename: `${activeContract.title}-signert.pdf`,
            contentType: "application/pdf",
            uploadedById: user.id,
            visibility: "private",
        });

        // Attach them immediately so the staged-asset cleanup job leaves them be.
        await bucket.promoteAsset(signatureFileKey);
        await bucket.promoteAsset(signedPdfKey);

        const [signature] = await db
            .insert(schema.contractSignature)
            .values({
                contractId: activeContract.id,
                userId: user.id,
                signedAt,
                signedName: body.signedName,
                signedPdfKey,
                signedPdfHash: createHash("sha256")
                    .update(stampedPdf)
                    .digest("hex"),
                signatureFileKey,
                signerIp,
                signerUa,
            })
            .returning();

        if (!signature) {
            throw new HTTPException(500, {
                message: "Failed to record signature",
            });
        }

        // Notify group leaders for all groups the user belongs to that require contract signing
        const memberships = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.userId, user.id),
            with: { group: true },
        });

        const signingGroups = memberships
            .map((m) => m.group)
            .filter((g) => g.contractSigningRequired);

        const groupsNeedingLeaderLookup = signingGroups
            .filter((g) => !g.contactEmail)
            .map((g) => g.slug);

        const leaderEmailByGroup = new Map<string, string>();
        if (groupsNeedingLeaderLookup.length > 0) {
            const leaders = await db.query.groupMembership.findMany({
                where: and(
                    inArray(
                        schema.groupMembership.groupSlug,
                        groupsNeedingLeaderLookup,
                    ),
                    eq(schema.groupMembership.role, "leader"),
                ),
                with: { user: true },
            });
            for (const leader of leaders) {
                if (!leaderEmailByGroup.has(leader.groupSlug)) {
                    leaderEmailByGroup.set(leader.groupSlug, leader.user.email);
                }
            }
        }

        for (const grp of signingGroups) {
            const notifyEmail =
                grp.contactEmail ?? leaderEmailByGroup.get(grp.slug) ?? null;

            if (notifyEmail) {
                // The signature is already committed, so a failing notification
                // must not fail the request: the member would be shown an error
                // for a signing that went through, and their retry would come
                // back as 409 "already signed".
                try {
                    await email.sendEmailTemplate(
                        {
                            from: env.MAIL_FROM,
                            to: notifyEmail,
                            subject: `${user.name} har signert frivillighetskontrakten`,
                        },
                        "ContractSignedEmail",
                        {
                            memberName: user.name,
                            groupName: grp.name,
                            signedAt: signature.signedAt.toISOString(),
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    );
                } catch (error) {
                    logger.error(
                        { err: error, userId: user.id, groupSlug: grp.slug },
                        "Failed to queue contract signed email",
                    );
                }
            }
        }

        return c.json(
            {
                message: "Contract signed successfully",
                signedAt: signature.signedAt.toISOString(),
            },
            201,
        );
    },
);
