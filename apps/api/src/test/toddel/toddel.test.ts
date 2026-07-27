import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/** Put a file in storage the way POST /api/assets would, and hand back its key. */
async function stageAsset(
    bucket: {
        upload: (
            key: string,
            body: Buffer,
            meta: { originalFilename: string; contentType: string },
        ) => Promise<string>;
    },
    key: string,
    contentType: string,
): Promise<string> {
    return bucket.upload(key, Buffer.from("file bytes"), {
        originalFilename: key.split("/").pop() ?? key,
        contentType,
    });
}

describe("TÖDDEL archive", () => {
    integrationTest(
        "Complete issue lifecycle: publish, list, update, delete",
        async ({ ctx }) => {
            const { db, bucket } = ctx;

            const editor = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["toddel:manage"]);

            const editorClient = await ctx.utils.clientForUser(editor);
            const userClient = await ctx.utils.clientForUser(regularUser);

            const pdfKey = await stageAsset(
                bucket,
                "uploads/2026/07/issue-99.pdf",
                "application/pdf",
            );
            const coverKey = await stageAsset(
                bucket,
                "uploads/2026/07/issue-99.png",
                "image/png",
            );

            // === CREATE ===

            const created = await editorClient.api.toddel.$post({
                json: {
                    edition: 99,
                    title: "Töddel",
                    publishedAt: "2026-07-01",
                    pdfKey,
                    imageKey: coverKey,
                },
            });

            expect(created.status).toBe(201);
            const issue = await created.json();
            expect(issue.edition).toBe(99);
            expect(issue.pdfUrl).toContain(`/api/assets/${pdfKey}`);
            expect(issue.imageUrl).toContain(`/api/assets/${coverKey}`);

            // Both files must survive the staging cleanup now that an issue
            // links to them.
            const promoted = await db.query.asset.findMany({
                where: eq(schema.asset.status, "ready"),
            });
            expect(promoted.map((a) => a.key)).toEqual(
                expect.arrayContaining([pdfKey, coverKey]),
            );

            // === PERMISSIONS ===

            const forbidden = await userClient.api.toddel.$post({
                json: {
                    edition: 100,
                    title: "Nope",
                    publishedAt: "2026-07-01",
                    pdfKey,
                },
            });
            expect(forbidden.status).toBe(403);

            // === VALIDATION ===

            const duplicate = await editorClient.api.toddel.$post({
                json: {
                    edition: 99,
                    title: "Duplicate",
                    publishedAt: "2026-07-02",
                    pdfKey,
                },
            });
            expect(duplicate.status).toBe(409);

            const unknownAsset = await editorClient.api.toddel.$post({
                json: {
                    edition: 100,
                    title: "Missing file",
                    publishedAt: "2026-07-02",
                    pdfKey: "uploads/2026/07/does-not-exist.pdf",
                },
            });
            expect(unknownAsset.status).toBe(400);

            // === LIST (public) ===

            const listed = await ctx.utils.client().api.toddel.$get();
            expect(listed.status).toBe(200);
            expect((await listed.json()).some((i) => i.edition === 99)).toBe(
                true,
            );

            // === UPDATE ===

            const updated = await editorClient.api.toddel[":edition"].$patch({
                param: { edition: "99" },
                json: { title: "Töddel – revidert" },
            });

            expect(updated.status).toBe(200);
            const updatedIssue = await updated.json();
            expect(updatedIssue.title).toBe("Töddel – revidert");
            // Files were not touched, so they must not be cleared.
            expect(updatedIssue.pdfUrl).toBe(issue.pdfUrl);
            expect(updatedIssue.imageUrl).toBe(issue.imageUrl);

            const cleared = await editorClient.api.toddel[":edition"].$patch({
                param: { edition: "99" },
                json: { imageKey: null },
            });
            expect((await cleared.json()).imageUrl).toBe(null);

            // === DELETE ===

            const forbiddenDelete = await userClient.api.toddel[
                ":edition"
            ].$delete({ param: { edition: "99" } });
            expect(forbiddenDelete.status).toBe(403);

            const deleted = await editorClient.api.toddel[":edition"].$delete({
                param: { edition: "99" },
            });
            expect(deleted.status).toBe(200);

            const missing = await editorClient.api.toddel[":edition"].$delete({
                param: { edition: "99" },
            });
            expect(missing.status).toBe(404);
        },
    );
});
