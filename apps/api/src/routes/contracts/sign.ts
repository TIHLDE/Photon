import { schema } from "@photon/db";
import { enqueueEmail } from "@photon/email";
import { ContractSignedEmail } from "@photon/email/templates";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { signContractResponseSchema } from "./schema";

export const signContractRoute = route().post(
    "/sign",
    describeRoute({
        tags: ["contracts"],
        summary: "Sign the active contract",
        operationId: "signContract",
        description:
            "Signs the active volunteer contract for the authenticated user. Sends email to notification contacts of all groups the user belongs to that require contract signing.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: signContractResponseSchema,
            description: "Contract signed",
        })
        .response({ statusCode: 409, description: "Already signed" })
        .notFound({ description: "No active contract" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const user = c.get("user");
        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const { db, queue } = c.get("ctx");

        const activeContract = await db.query.contract.findFirst({
            where: eq(schema.contract.isActive, true),
        });

        if (!activeContract) {
            throw new HTTPException(404, {
                message: "No active contract found",
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

        const [signature] = await db
            .insert(schema.contractSignature)
            .values({
                contractId: activeContract.id,
                userId: user.id,
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

        for (const membership of memberships) {
            const grp = membership.group;
            if (!grp.contractSigningRequired) continue;

            // Resolve notification email: configured → group contact → leader's email
            let notifyEmail: string | null =
                grp.contractNotificationEmail ?? grp.contactEmail ?? null;

            if (!notifyEmail) {
                const leader = await db.query.groupMembership.findFirst({
                    where: and(
                        eq(schema.groupMembership.groupSlug, grp.slug),
                        eq(schema.groupMembership.role, "leader"),
                    ),
                    with: { user: true },
                });
                notifyEmail = leader?.user.email ?? null;
            }

            if (notifyEmail) {
                await enqueueEmail(
                    {
                        to: notifyEmail,
                        subject: `${user.name} har signert frivillighetskontrakten`,
                        component: ContractSignedEmail({
                            memberName: user.name,
                            groupName: grp.name,
                            signedAt: signature.signedAt.toISOString(),
                        }),
                    },
                    { queue },
                );
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
