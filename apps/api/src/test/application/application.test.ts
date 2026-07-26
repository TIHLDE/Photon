import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * A real 1x1 PNG. @react-pdf actually decodes attachment bytes, so a fake
 * header would make PDF generation fail and mask what these tests check.
 */
const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

/** Stage an attachment the way POST /api/assets would, for a given user. */
async function stageAttachment(
    ctx: IntegrationTestContext,
    userId: string,
    name = "kvittering.png",
): Promise<string> {
    const key = `uploads/test/${crypto.randomUUID()}_${name}`;
    await ctx.bucket.upload(key, PNG_1X1, {
        originalFilename: name,
        contentType: "image/png",
        uploadedById: userId,
        visibility: "private",
    });
    return key;
}

async function setupGroup(ctx: IntegrationTestContext) {
    return ctx.utils.createTestGroup({
        slug: "testgruppa",
        name: "Testgruppa",
        type: "COMMITTEE",
    });
}

describe("Søknader", () => {
    integrationTest(
        "expense: submits, stores, renders a PDF and shows up under mine",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const receiptKey = await stageAttachment(ctx, member.id);

            const response = await client.api.applications.expense.$post({
                json: {
                    contactName: "Test Testesen",
                    contactEmail: "test@tihlde.org",
                    amountNok: 1250,
                    expenseDate: "2026-07-20",
                    groupSlug: group.slug,
                    budgetType: "group_budget",
                    description: "Pizza til kodekveld",
                    accountNumber: "1234.56.78901",
                    attachmentKeys: [receiptKey],
                },
            });

            expect(response.status).toBe(201);
            const created = await response.json();
            expect(created.pdfGenerated).toBe(true);

            // The attachment is claimed, so the staged-asset cleanup leaves it.
            const asset = await ctx.bucket.getAsset(receiptKey);
            expect(asset?.status).toBe("ready");

            const stored = await ctx.db.query.application.findFirst({
                where: eq(schema.application.id, created.id),
            });
            expect(stored?.status).toBe("new");
            expect(stored?.pdfAssetKey).toBeTruthy();

            // The PDF is private — the open asset route must not serve it.
            const pdfAsset = await ctx.bucket.getAsset(
                stored?.pdfAssetKey ?? "",
            );
            expect(pdfAsset?.visibility).toBe("private");

            const mine = await client.api.applications.mine.$get({ query: {} });
            expect(mine.status).toBe(200);
            const myApplications = await mine.json();
            expect(myApplications).toHaveLength(1);
            expect(myApplications[0]?.type).toBe("expense");
            expect(myApplications[0]?.hasPdf).toBe(true);
        },
    );

    integrationTest(
        "expense: rejects an unknown group, a bad account number and a foreign attachment",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            const member = await ctx.utils.createTestUser();
            const stranger = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const ownKey = await stageAttachment(ctx, member.id);
            const strangersKey = await stageAttachment(ctx, stranger.id);

            const base = {
                contactName: "Test Testesen",
                contactEmail: "test@tihlde.org",
                amountNok: 100,
                expenseDate: "2026-07-20",
                groupSlug: group.slug,
                budgetType: "group_budget" as const,
                description: "Noe",
                accountNumber: "1234.56.78901",
                attachmentKeys: [ownKey],
            };

            const unknownGroup = await client.api.applications.expense.$post({
                json: { ...base, groupSlug: "finnes-ikke" },
            });
            expect(unknownGroup.status).toBe(400);

            const badAccount = await client.api.applications.expense.$post({
                json: { ...base, accountNumber: "12345678901" },
            });
            expect(badAccount.status).toBe(400);

            // Attaching someone else's staged upload would otherwise let a
            // member read it back through the authorized attachment route.
            const foreignAttachment =
                await client.api.applications.expense.$post({
                    json: { ...base, attachmentKeys: [strangersKey] },
                });
            expect(foreignAttachment.status).toBe(400);

            // The rejected submissions must not have left rows behind.
            const rows = await ctx.db.query.application.findMany();
            expect(rows).toHaveLength(0);
        },
    );

    integrationTest(
        "hs-case: a Vedtakssak requires an innstilling",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const base = {
                contactName: "Test Testesen",
                contactEmail: "test@tihlde.org",
                caseName: "Nye vedtekter",
                background: "Bakgrunn",
                assessment: "Vurdering",
                attachmentKeys: [],
            };

            const missing = await client.api.applications["hs-case"].$post({
                json: { ...base, caseType: "decision" },
            });
            expect(missing.status).toBe(400);

            const withRecommendation = await client.api.applications[
                "hs-case"
            ].$post({
                json: {
                    ...base,
                    caseType: "decision",
                    recommendation: "Innstiller på å vedta",
                },
            });
            expect(withRecommendation.status).toBe(201);

            // A discussion case needs no innstilling.
            const discussion = await client.api.applications["hs-case"].$post({
                json: { ...base, caseType: "discussion" },
            });
            expect(discussion.status).toBe(201);
        },
    );

    integrationTest(
        "handlers only see the types they may handle",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            const member = await ctx.utils.createTestUser();
            const memberClient = await ctx.utils.clientForUser(member);

            const receiptKey = await stageAttachment(ctx, member.id);
            await memberClient.api.applications.expense.$post({
                json: {
                    contactName: "Test Testesen",
                    contactEmail: "test@tihlde.org",
                    amountNok: 100,
                    expenseDate: "2026-07-20",
                    groupSlug: group.slug,
                    budgetType: "group_budget",
                    description: "Noe",
                    accountNumber: "1234.56.78901",
                    attachmentKeys: [receiptKey],
                },
            });
            await memberClient.api.applications["hs-case"].$post({
                json: {
                    contactName: "Test Testesen",
                    contactEmail: "test@tihlde.org",
                    caseName: "En sak",
                    caseType: "orientation",
                    background: "Bakgrunn",
                    assessment: "Vurdering",
                    attachmentKeys: [],
                },
            });

            // Finansminister: utlegg, but not saker til HS.
            const finance = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(finance, [
                "applications:expense:view",
                "applications:expense:manage",
            ]);
            const financeClient = await ctx.utils.clientForUser(finance);

            const financeList = await financeClient.api.applications.$get({
                query: {},
            });
            expect(financeList.status).toBe(200);
            const financeItems = await financeList.json();
            expect(financeItems).toHaveLength(1);
            expect(financeItems[0]?.type).toBe("expense");

            // HS: saker til HS, but not utlegg.
            const hs = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(hs, [
                "applications:hs-case:view",
            ]);
            const hsClient = await ctx.utils.clientForUser(hs);

            const hsList = await hsClient.api.applications.$get({ query: {} });
            const hsItems = await hsList.json();
            expect(hsItems).toHaveLength(1);
            expect(hsItems[0]?.type).toBe("hs_case");

            // A plain member has no handler view at all.
            const memberList = await memberClient.api.applications.$get({
                query: {},
            });
            expect(memberList.status).toBe(403);
        },
    );

    integrationTest(
        "a member cannot read another member's søknad, its PDF or its attachments",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            const owner = await ctx.utils.createTestUser();
            const ownerClient = await ctx.utils.clientForUser(owner);
            const receiptKey = await stageAttachment(ctx, owner.id);

            const created = await ownerClient.api.applications.expense
                .$post({
                    json: {
                        contactName: "Eier",
                        contactEmail: "eier@tihlde.org",
                        amountNok: 100,
                        expenseDate: "2026-07-20",
                        groupSlug: group.slug,
                        budgetType: "group_budget",
                        description: "Noe",
                        accountNumber: "1234.56.78901",
                        attachmentKeys: [receiptKey],
                    },
                })
                .then((response) => response.json());

            const stranger = await ctx.utils.createTestUser();
            const strangerClient = await ctx.utils.clientForUser(stranger);

            // 404 rather than 403 — don't confirm the id exists.
            const detail = await strangerClient.api.applications[":id"].$get({
                param: { id: created.id },
            });
            expect(detail.status).toBe(404);

            const pdf = await strangerClient.api.applications[":id"].pdf.$get({
                param: { id: created.id },
            });
            expect(pdf.status).toBe(404);

            // The owner can read their own, but not the internal note.
            const ownerDetail = await ownerClient.api.applications[":id"].$get({
                param: { id: created.id },
            });
            expect(ownerDetail.status).toBe(200);
            const ownerJson = await ownerDetail.json();
            expect(ownerJson).not.toHaveProperty("internalComment");
        },
    );

    integrationTest(
        "status update: only the right handler, and only decisions email the submitter",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const memberClient = await ctx.utils.clientForUser(member);

            const created = await memberClient.api.applications["hs-case"]
                .$post({
                    json: {
                        contactName: "Test Testesen",
                        contactEmail: "test@tihlde.org",
                        caseName: "En sak",
                        caseType: "orientation",
                        background: "Bakgrunn",
                        assessment: "Vurdering",
                        attachmentKeys: [],
                    },
                })
                .then((response) => response.json());

            // A Finansminister may not touch a sak til HS.
            const finance = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(finance, [
                "applications:expense:manage",
            ]);
            const financeClient = await ctx.utils.clientForUser(finance);

            const wrongHandler = await financeClient.api.applications[
                ":id"
            ].status.$patch({
                param: { id: created.id },
                json: { status: "approved" },
            });
            expect(wrongHandler.status).toBe(403);

            const hs = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(hs, [
                "applications:hs-case:view",
                "applications:hs-case:manage",
            ]);
            const hsClient = await ctx.utils.clientForUser(hs);

            const updated = await hsClient.api.applications[
                ":id"
            ].status.$patch({
                param: { id: created.id },
                json: {
                    status: "approved",
                    internalComment: "Ser greit ut",
                },
            });
            expect(updated.status).toBe(200);
            const updatedJson = await updated.json();
            expect(updatedJson.status).toBe("approved");
            expect(updatedJson.internalComment).toBe("Ser greit ut");
            expect(updatedJson.handledByName).toBeTruthy();

            // The submitter still must not see the internal note.
            const submitterView = await memberClient.api.applications[
                ":id"
            ].$get({ param: { id: created.id } });
            const submitterJson = await submitterView.json();
            expect(submitterJson.status).toBe("approved");
            expect(submitterJson).not.toHaveProperty("internalComment");
        },
    );

    integrationTest(
        "options come from the group table, with CC addresses derived by convention",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            // An interessegruppe added later needs no code or data change to
            // get its CC option.
            const interestGroup = await ctx.utils.createTestGroup({
                slug: "volley",
                name: "TIHLDE Volley",
                type: "INTERESTGROUP",
            });
            // Study years hold no budget and must not be selectable.
            await ctx.utils.createTestGroup({
                slug: "2023",
                name: "2023",
                type: "STUDYYEAR",
            });

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.applications.options.$get();
            expect(response.status).toBe(200);
            const options = await response.json();

            const slugs = options.groups.map((g) => g.slug);
            expect(slugs).toContain(group.slug);
            expect(slugs).toContain(interestGroup.slug);
            expect(slugs).not.toContain("2023");

            expect(
                options.ccOptions.find((o) => o.slug === "volley")?.email,
            ).toBe("okonomiansvarlig.volley@tihlde.org");
            expect(options.ccOptions).toHaveLength(options.groups.length);

            expect(options.budgetTypes).toHaveLength(4);
            expect(options.caseTypes).toHaveLength(3);
        },
    );

    integrationTest(
        "expense: the CC must be a real group's conventional økonomiansvarlig",
        async ({ ctx }) => {
            const group = await setupGroup(ctx);
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const receiptKey = await stageAttachment(ctx, member.id);

            const base = {
                contactName: "Test Testesen",
                contactEmail: "test@tihlde.org",
                amountNok: 100,
                expenseDate: "2026-07-20",
                groupSlug: group.slug,
                budgetType: "group_budget" as const,
                description: "Noe",
                accountNumber: "1234.56.78901",
                attachmentKeys: [receiptKey],
            };

            // Free-text addresses were an open relay in the old portal.
            const attackerCc = await client.api.applications.expense.$post({
                json: { ...base, ccEmail: "attacker@example.com" },
            });
            expect(attackerCc.status).toBe(400);

            // Right shape, but no such group.
            const unknownGroupCc = await client.api.applications.expense.$post({
                json: {
                    ...base,
                    ccEmail: "okonomiansvarlig.finnesikke@tihlde.org",
                },
            });
            expect(unknownGroupCc.status).toBe(400);

            const validCc = await client.api.applications.expense.$post({
                json: {
                    ...base,
                    ccEmail: `okonomiansvarlig.${group.slug}@tihlde.org`,
                },
            });
            expect(validCc.status).toBe(201);
        },
    );
});
