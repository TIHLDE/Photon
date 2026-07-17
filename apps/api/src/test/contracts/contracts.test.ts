import { createHash } from "node:crypto";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Contract upload, signing and signed-PDF retrieval.
 *
 * The signature is stamped into the PDF at signing time and stored, so these
 * tests assert on what was persisted rather than re-deriving it.
 */

/** A one-page PDF standing in for an uploaded contract. */
async function makeContractPdf(): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    return Buffer.from(await pdf.save());
}

/** A 2x2 PNG data URL, as the signature pad would emit. */
const SIGNATURE_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8//8/AzbAxIAD0EYCAFYuAQXf7cwtAAAAAElFTkSuQmCC";

const PLACEMENT = {
    page: 0,
    xPct: 0.16,
    yPct: 0.7,
    wPct: 0.35,
    hPct: 0.09,
};

describe("contracts", () => {
    describe("signing", () => {
        integrationTest(
            "stamps the signature into the PDF and stores it privately",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, [
                    "contracts:create",
                    "contracts:update",
                ]);

                // Upload the source PDF, then register and activate a contract.
                const fileKey = "test/contract.pdf";
                await ctx.bucket.upload(fileKey, await makeContractPdf(), {
                    originalFilename: "contract.pdf",
                    contentType: "application/pdf",
                });

                const created = await adminClient.api.contracts.$post({
                    json: {
                        title: "Frivillighetskontrakt",
                        version: "2026-01",
                        fileKey,
                        signaturePlacement: PLACEMENT,
                        namePlacement: { ...PLACEMENT, yPct: 0.85 },
                    },
                });
                expect(created.status).toBe(201);
                const contract = await created.json();

                const activated = await adminClient.api.contracts[
                    ":id"
                ].activate.$patch({ param: { id: contract.id } });
                expect(activated.status).toBe(200);

                // A regular member signs it.
                const member = await ctx.utils.createTestUser();
                const memberClient = await ctx.utils.clientForUser(member);

                const signed = await memberClient.api.contracts.sign.$post({
                    json: {
                        signedName: "Kari Nordmann",
                        signatureDataUrl: SIGNATURE_DATA_URL,
                    },
                });
                expect(signed.status).toBe(201);

                const row = await ctx.db.query.contractSignature.findFirst();
                expect(row?.signedName).toBe("Kari Nordmann");
                expect(row?.signedPdfKey).toBeTruthy();
                expect(row?.signatureFileKey).toBeTruthy();
                // SHA-256 hex.
                expect(row?.signedPdfHash).toMatch(/^[0-9a-f]{64}$/);

                // The stamped PDF is real, and carries the appended audit page.
                const stamped = await ctx.bucket.download(row!.signedPdfKey);
                const parsed = await PDFDocument.load(new Uint8Array(stamped));
                expect(parsed.getPageCount()).toBe(2);

                // The stored hash must match the stored bytes.
                const hash = createHash("sha256").update(stamped).digest("hex");
                expect(hash).toBe(row?.signedPdfHash);

                // Neither artefact may be reachable without authorization.
                const sigAsset = await ctx.bucket.getAsset(
                    row!.signatureFileKey,
                );
                const pdfAsset = await ctx.bucket.getAsset(row!.signedPdfKey);
                expect(sigAsset?.visibility).toBe("private");
                expect(pdfAsset?.visibility).toBe("private");
            },
            500_000,
        );

        integrationTest(
            "rejects a second signature from the same user",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, [
                    "contracts:create",
                    "contracts:update",
                ]);

                const fileKey = "test/contract-dup.pdf";
                await ctx.bucket.upload(fileKey, await makeContractPdf(), {
                    originalFilename: "contract.pdf",
                    contentType: "application/pdf",
                });

                const created = await adminClient.api.contracts.$post({
                    json: {
                        title: "Kontrakt",
                        version: "2026-01",
                        fileKey,
                        signaturePlacement: PLACEMENT,
                    },
                });
                const contract = await created.json();
                await adminClient.api.contracts[":id"].activate.$patch({
                    param: { id: contract.id },
                });

                const member = await ctx.utils.createTestUser();
                const memberClient = await ctx.utils.clientForUser(member);
                const body = {
                    signedName: "Ola Nordmann",
                    signatureDataUrl: SIGNATURE_DATA_URL,
                };

                const first = await memberClient.api.contracts.sign.$post({
                    json: body,
                });
                expect(first.status).toBe(201);

                const second = await memberClient.api.contracts.sign.$post({
                    json: body,
                });
                expect(second.status).toBe(409);
            },
            500_000,
        );

        integrationTest(
            "rejects a signature that is not a PNG data URL",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, [
                    "contracts:create",
                    "contracts:update",
                ]);

                const fileKey = "test/contract-bad.pdf";
                await ctx.bucket.upload(fileKey, await makeContractPdf(), {
                    originalFilename: "contract.pdf",
                    contentType: "application/pdf",
                });

                const created = await adminClient.api.contracts.$post({
                    json: { title: "Kontrakt", version: "1", fileKey },
                });
                const contract = await created.json();
                await adminClient.api.contracts[":id"].activate.$patch({
                    param: { id: contract.id },
                });

                const member = await ctx.utils.createTestUser();
                const memberClient = await ctx.utils.clientForUser(member);

                const response = await memberClient.api.contracts.sign.$post({
                    json: {
                        signedName: "Ola Nordmann",
                        signatureDataUrl: "data:image/jpeg;base64,abc",
                    },
                });
                expect(response.status).toBe(400);
            },
            500_000,
        );
    });

    describe("signed pdf download", () => {
        integrationTest(
            "serves the signer their own PDF but not another member's",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, [
                    "contracts:create",
                    "contracts:update",
                ]);

                const fileKey = "test/contract-dl.pdf";
                await ctx.bucket.upload(fileKey, await makeContractPdf(), {
                    originalFilename: "contract.pdf",
                    contentType: "application/pdf",
                });
                const created = await adminClient.api.contracts.$post({
                    json: {
                        title: "Kontrakt",
                        version: "1",
                        fileKey,
                        signaturePlacement: PLACEMENT,
                    },
                });
                const contract = await created.json();
                await adminClient.api.contracts[":id"].activate.$patch({
                    param: { id: contract.id },
                });

                const signer = await ctx.utils.createTestUser();
                const signerClient = await ctx.utils.clientForUser(signer);
                await signerClient.api.contracts.sign.$post({
                    json: {
                        signedName: "Kari Nordmann",
                        signatureDataUrl: SIGNATURE_DATA_URL,
                    },
                });

                const own =
                    await signerClient.api.contracts["signed-pdf"].$get();
                expect(own.status).toBe(200);
                expect(own.headers.get("content-type")).toBe("application/pdf");

                // A member without contracts:manage cannot read someone else's.
                const other = await ctx.utils.createTestUser();
                const otherClient = await ctx.utils.clientForUser(other);
                const forbidden = await otherClient.api.contracts["signed-pdf"][
                    ":userId"
                ].$get({ param: { userId: signer.id } });
                expect(forbidden.status).toBe(403);

                // The signer has not signed nothing — but a non-signer has no PDF.
                const missing =
                    await otherClient.api.contracts["signed-pdf"].$get();
                expect(missing.status).toBe(404);
            },
            500_000,
        );
    });

    describe("group role grants contract access", () => {
        integrationTest(
            "joining a group with an RBAC role grants and revokes it",
            async ({ ctx }) => {
                // Mirrors how Hovedstyret gets contract rights: the group carries
                // an RBAC role, and membership is what confers it.
                const [role] = await ctx.db
                    .insert(schema.role)
                    .values({
                        name: "hs-test",
                        description: "Test board role",
                        position: 3,
                        permissions: ["contracts:view", "contracts:create"],
                    })
                    .returning();

                const group = await ctx.utils.createTestGroup({
                    slug: "hs-test-group",
                });
                await ctx.db
                    .update(schema.group)
                    .set({ roleId: role!.id })
                    .where(eq(schema.group.slug, group.slug));

                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);

                const member = await ctx.utils.createTestUser();

                // Without the group, the member cannot register a contract.
                const memberClient = await ctx.utils.clientForUser(member);
                const before = await memberClient.api.contracts.$post({
                    json: { title: "x", version: "1", fileKey: "irrelevant" },
                });
                expect(before.status).toBe(403);

                const added = await adminClient.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: { userId: member.id, role: "member" },
                });
                expect(added.status).toBe(201);

                const granted = await ctx.db.query.userRole.findFirst({
                    where: and(
                        eq(schema.userRole.userId, member.id),
                        eq(schema.userRole.roleId, role!.id),
                    ),
                });
                expect(granted).toBeTruthy();

                const removed = await adminClient.api.groups[
                    ":groupSlug"
                ].members[":userId"].$delete({
                    param: { groupSlug: group.slug, userId: member.id },
                });
                expect(removed.status).toBe(204);

                const revoked = await ctx.db.query.userRole.findFirst({
                    where: and(
                        eq(schema.userRole.userId, member.id),
                        eq(schema.userRole.roleId, role!.id),
                    ),
                });
                expect(revoked).toBeFalsy();
            },
            500_000,
        );
    });
});
