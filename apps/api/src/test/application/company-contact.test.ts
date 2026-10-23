import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

const SUBMISSION = {
    company: "Testbedrift AS",
    contactName: "Kari Nordmann",
    contactEmail: "kari@testbedrift.no",
    eventTypes: ["Bedriftspresentasjon", "Kurs/workshop"],
    semesters: ["Høst 2026"],
    comment: "Vi ønsker kontakt om høstsemesteret.",
    phone: "+47 123 45 678",
    companyType: "Start-up",
    hasTrondheimOffice: true,
    about: "Vi lager programvare for kommuner.",
    themes: ["Cybersikkerhet"],
    classLevels: ["2. klasse", "3. klasse"],
    participants: "20-30",
    extras: ["Samarbeid med Online linjeforening"],
};

/**
 * The public form is unauthenticated, so each submission needs a distinct
 * client IP — otherwise the shared rate-limit bucket makes later tests fail
 * for the wrong reason.
 */
function publicClient(ctx: IntegrationTestContext, ip: string) {
    return ctx.utils.client({ "x-forwarded-for": ip });
}

describe("Henvendelser fra bedrift", () => {
    integrationTest(
        "the public form stores the enquiry as an application",
        async ({ ctx }) => {
            const response = await publicClient(
                ctx,
                "203.0.113.10",
            ).api.company.contact.$post({ json: SUBMISSION });

            expect(response.status).toBe(200);

            const stored = await ctx.db.query.application.findFirst({
                where: eq(schema.application.type, "company_contact"),
                with: { companyContact: true },
            });

            expect(stored?.status).toBe("new");
            // No session behind a public form — the record must survive
            // without a submitting user.
            expect(stored?.submittedById).toBeNull();
            expect(stored?.contactName).toBe(SUBMISSION.contactName);
            expect(stored?.contactEmail).toBe(SUBMISSION.contactEmail);
            expect(stored?.signature).toContain(SUBMISSION.company);
            expect(stored?.companyContact?.company).toBe(SUBMISSION.company);
            expect(stored?.companyContact?.eventTypes).toEqual(
                SUBMISSION.eventTypes,
            );
            expect(stored?.companyContact?.semesters).toEqual(
                SUBMISSION.semesters,
            );
            expect(stored?.companyContact?.comment).toBe(SUBMISSION.comment);
        },
    );

    integrationTest(
        "the details are sent in the company contact email",
        async ({ ctx }) => {
            const sendEmailTemplate = vi.spyOn(ctx.email, "sendEmailTemplate");

            const response = await publicClient(
                ctx,
                "203.0.113.14",
            ).api.company.contact.$post({ json: SUBMISSION });
            expect(response.status).toBe(200);

            const call = sendEmailTemplate.mock.calls.find(
                ([, template]) => template === "CompanyContactEmail",
            );
            expect(call?.[2]).toMatchObject({
                phone: SUBMISSION.phone,
                companyType: SUBMISSION.companyType,
                hasTrondheimOffice: true,
                about: SUBMISSION.about,
                themes: SUBMISSION.themes,
                classLevels: SUBMISSION.classLevels,
                participants: SUBMISSION.participants,
                extras: SUBMISSION.extras,
            });
        },
    );

    integrationTest("the optional fields can be left out", async ({ ctx }) => {
        const response = await publicClient(
            ctx,
            "203.0.113.15",
        ).api.company.contact.$post({
            json: {
                company: SUBMISSION.company,
                contactName: SUBMISSION.contactName,
                contactEmail: SUBMISSION.contactEmail,
                companyType: SUBMISSION.companyType,
                about: SUBMISSION.about,
                eventTypes: SUBMISSION.eventTypes,
                semesters: SUBMISSION.semesters,
            },
        });

        expect(response.status).toBe(200);
    });

    integrationTest(
        "only company-contact handlers see it in the admin inbox",
        async ({ ctx }) => {
            await publicClient(ctx, "203.0.113.11").api.company.contact.$post({
                json: SUBMISSION,
            });

            // Næringslivsministeren.
            const handler = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(handler, [
                "company-contact:view",
                "company-contact:manage",
            ]);
            const handlerClient = await ctx.utils.clientForUser(handler);

            const list = await handlerClient.api.applications.$get({
                query: {},
            });
            expect(list.status).toBe(200);
            const items = await list.json();
            expect(items).toHaveLength(1);
            expect(items[0]?.type).toBe("company_contact");
            // The list title is what a handler scans for.
            expect(items[0]?.title).toBe(SUBMISSION.company);

            const detail = await handlerClient.api.applications[":id"].$get({
                param: { id: items[0]?.id ?? "" },
            });
            const detailJson = await detail.json();
            expect(detailJson.companyContact?.eventTypes).toEqual(
                SUBMISSION.eventTypes,
            );

            // A Finansminister has no business seeing bedriftshenvendelser.
            const finance = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(finance, [
                "applications:expense:view",
            ]);
            const financeClient = await ctx.utils.clientForUser(finance);
            const financeList = await financeClient.api.applications.$get({
                query: {},
            });
            expect(await financeList.json()).toHaveLength(0);

            // Neither does the all-types søknad grant: kontaktskjema is its
            // own permission domain, not a søknad sub-type.
            const allApplications = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(allApplications, [
                "applications:view",
                "applications:manage",
            ]);
            const allClient = await ctx.utils.clientForUser(allApplications);
            const allList = await allClient.api.applications.$get({
                query: {},
            });
            expect(await allList.json()).toHaveLength(0);
        },
    );

    integrationTest(
        "a handler can set the status without emailing the company",
        async ({ ctx }) => {
            await publicClient(ctx, "203.0.113.12").api.company.contact.$post({
                json: SUBMISSION,
            });

            const stored = await ctx.db.query.application.findFirst({
                where: eq(schema.application.type, "company_contact"),
            });

            const handler = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(handler, [
                "company-contact:view",
                "company-contact:manage",
            ]);
            const handlerClient = await ctx.utils.clientForUser(handler);

            const updated = await handlerClient.api.applications[
                ":id"
            ].status.$patch({
                param: { id: stored?.id ?? "" },
                json: {
                    status: "approved",
                    internalComment: "Avtalt bedpres i oktober",
                },
            });

            expect(updated.status).toBe(200);
            const updatedJson = await updated.json();
            expect(updatedJson.status).toBe("approved");
            expect(updatedJson.internalComment).toBe(
                "Avtalt bedpres i oktober",
            );
            expect(updatedJson.handledByName).toBeTruthy();
        },
    );

    integrationTest(
        "bedriftshenvendelser have no PDF to regenerate",
        async ({ ctx }) => {
            await publicClient(ctx, "203.0.113.13").api.company.contact.$post({
                json: SUBMISSION,
            });

            const stored = await ctx.db.query.application.findFirst({
                where: eq(schema.application.type, "company_contact"),
            });

            const handler = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(handler, [
                "company-contact:view",
                "company-contact:manage",
            ]);
            const handlerClient = await ctx.utils.clientForUser(handler);

            const detail = await handlerClient.api.applications[":id"].$get({
                param: { id: stored?.id ?? "" },
            });
            expect((await detail.json()).hasPdf).toBe(false);

            const regenerate = await handlerClient.api.applications[
                ":id"
            ].pdf.regenerate.$post({ param: { id: stored?.id ?? "" } });
            expect(regenerate.status).toBe(400);
        },
    );
});
