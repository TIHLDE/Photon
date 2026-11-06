import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

const CONTACT_EMAIL = "noen-andre@example.com";

describe("Kvittering på søknad", () => {
    integrationTest(
        "goes to the account, while handlers still see the contact address",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const sendEmailTemplate = vi.spyOn(ctx.email, "sendEmailTemplate");

            const response = await client.api.applications["hs-case"].$post({
                json: {
                    contactName: "Test Testesen",
                    contactEmail: CONTACT_EMAIL,
                    caseName: "Testsak",
                    caseType: "discussion",
                    background: "Bakgrunn",
                    assessment: "Vurdering",
                    attachmentKeys: [],
                },
            });
            expect(response.status).toBe(201);
            const { id } = await response.json();

            const receipts = sendEmailTemplate.mock.calls.filter(
                ([, template]) => template === "ApplicationReceiptEmail",
            );
            expect(receipts.map(([options]) => options.to)).toEqual([
                member.email,
            ]);

            const allRecipients = sendEmailTemplate.mock.calls.flatMap(
                ([options]) => [options.to, options.cc].flat(),
            );
            expect(allRecipients).not.toContain(CONTACT_EMAIL);

            const stored = await ctx.db.query.application.findFirst({
                where: { id },
            });
            expect(stored?.contactEmail).toBe(CONTACT_EMAIL);
        },
    );
});
