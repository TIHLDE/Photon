import type { Context } from "hono";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, clientIpFromForwardedFor } from "~/lib/client-ip";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

const envOverrides = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("@photon/core/env", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photon/core/env")>();
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_, prop: string) =>
                prop in envOverrides
                    ? envOverrides[prop]
                    : (actual.env as unknown as Record<string, unknown>)[prop],
        }),
    };
});

const REAL_CLIENT = "203.0.113.7";

const COMPANY_SUBMISSION = {
    company: "Testbedrift AS",
    contactName: "Test Testesen",
    contactEmail: "kontakt@testbedrift.no",
    eventTypes: ["Kurs/workshop"],
    semesters: ["Høst 2026"],
    companyType: "Start-up",
    hasTrondheimOffice: true,
    about: "Vi lager programvare.",
    themes: ["Cybersikkerhet"],
    classLevels: ["2. klasse"],
    extras: [],
};

function submitCompanyContact(
    ctx: IntegrationTestContext,
    forwardedFor: string | undefined,
    contactEmail = COMPANY_SUBMISSION.contactEmail,
) {
    return ctx.utils
        .client(forwardedFor ? { "x-forwarded-for": forwardedFor } : {})
        .api.company.contact.$post({
            json: { ...COMPANY_SUBMISSION, contactEmail },
        });
}

function requestAccountHelp(ctx: IntegrationTestContext, forwardedFor: string) {
    return ctx.utils
        .client({ "x-forwarded-for": forwardedFor })
        .api["account-link"].help.$post({
            json: { feideName: "Test", contactEmail: "test@example.com" },
        });
}

describe("clientIpFromForwardedFor", () => {
    it.each([
        ["nginx overwrites the header", REAL_CLIENT, REAL_CLIENT],
        [
            "nginx appends to what the client sent",
            `198.51.100.1, ${REAL_CLIENT}`,
            REAL_CLIENT,
        ],
        ["the client is on IPv6", "2001:db8::1", "2001:db8::1"],
        [
            "the address is IPv4-mapped",
            "::ffff:203.0.113.7",
            "::ffff:203.0.113.7",
        ],
    ])("finds the client when %s", (_, header, expected) => {
        expect(clientIpFromForwardedFor(header)).toBe(expected);
    });

    it.each([
        ["the header is missing", undefined],
        ["the header is empty", ""],
        [
            "an internal proxy sits behind nginx",
            "198.51.100.1, 203.0.113.7, 10.0.0.5",
        ],
        ["nginx only sees a gateway", "198.51.100.1, 172.18.0.1"],
        ["every hop is internal", "10.0.0.5, 172.18.0.2, 192.168.1.1"],
        ["every hop is loopback", "127.0.0.1, ::1"],
        ["the mapped address is internal", "::ffff:10.0.0.5"],
        ["the last hop is not an address", "203.0.113.7, unknown"],
        ["garbage stands behind an internal hop", "unknown, 10.0.0.5"],
    ])("gives no address when %s", (_, header) => {
        expect(clientIpFromForwardedFor(header)).toBeUndefined();
    });
});

describe("clientIp", () => {
    function requestWith(header: string | undefined) {
        const warn = vi.fn();
        const c = {
            req: { header: () => header },
            get: () => ({ warn }),
        } as unknown as Context;
        return { c, warn };
    }

    afterEach(() => {
        delete envOverrides.NODE_ENV;
    });

    it("warns in production when the proxy leaves no usable address", () => {
        envOverrides.NODE_ENV = "production";
        const { c, warn } = requestWith("172.18.0.2");
        expect(clientIp(c)).toBeUndefined();
        expect(warn).toHaveBeenCalledOnce();
    });

    it("stays quiet in production when it finds the client", () => {
        envOverrides.NODE_ENV = "production";
        const { c, warn } = requestWith(REAL_CLIENT);
        expect(clientIp(c)).toBe(REAL_CLIENT);
        expect(warn).not.toHaveBeenCalled();
    });

    it("stays quiet outside production, where there is often no proxy", () => {
        const { c, warn } = requestWith(undefined);
        expect(clientIp(c)).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
    });
});

describe("rate limits on public forms", () => {
    integrationTest(
        "the company contact limit holds when the client changes the header",
        async ({ ctx }) => {
            for (let i = 0; i < 5; i++) {
                const response = await submitCompanyContact(
                    ctx,
                    `198.51.100.${i}, ${REAL_CLIENT}`,
                );
                expect(response.status).toBe(200);
            }

            const blocked = await submitCompanyContact(
                ctx,
                `198.51.100.200, ${REAL_CLIENT}`,
            );
            expect(blocked.status).toBe(429);
        },
    );

    integrationTest(
        "the account help limit holds when the client changes the header",
        async ({ ctx }) => {
            for (let i = 0; i < 3; i++) {
                const response = await requestAccountHelp(
                    ctx,
                    `198.51.100.${i}, ${REAL_CLIENT}`,
                );
                expect(response.status).toBe(200);
            }

            const blocked = await requestAccountHelp(
                ctx,
                `198.51.100.200, ${REAL_CLIENT}`,
            );
            expect(blocked.status).toBe(429);
        },
    );

    integrationTest(
        "two clients behind nginx keep separate limits",
        async ({ ctx }) => {
            for (let i = 0; i < 5; i++) {
                await submitCompanyContact(ctx, REAL_CLIENT);
            }
            expect((await submitCompanyContact(ctx, REAL_CLIENT)).status).toBe(
                429,
            );

            const other = await submitCompanyContact(ctx, "203.0.113.8");
            expect(other.status).toBe(200);
        },
    );

    integrationTest.for([
        ["only internal hops", "172.18.0.2"],
        ["no header", undefined],
    ] as const)(
        "with %s senders do not share one limit",
        async ([, forwardedFor], { ctx }) => {
            for (let i = 0; i < 6; i++) {
                const response = await submitCompanyContact(
                    ctx,
                    forwardedFor,
                    `kontakt-${i}@testbedrift.no`,
                );
                expect(response.status).toBe(200);
            }

            for (let i = 0; i < 5; i++) {
                await submitCompanyContact(
                    ctx,
                    forwardedFor,
                    "samme@testbedrift.no",
                );
            }
            const blocked = await submitCompanyContact(
                ctx,
                forwardedFor,
                "samme@testbedrift.no",
            );
            expect(blocked.status).toBe(429);
        },
    );
});

describe("rate limits behind an internal last hop", () => {
    integrationTest(
        "changing the header buys no new limit",
        async ({ ctx }) => {
            for (let i = 0; i < 5; i++) {
                const response = await submitCompanyContact(
                    ctx,
                    `198.51.100.${i}, 172.18.0.1`,
                );
                expect(response.status).toBe(200);
            }

            const blocked = await submitCompanyContact(
                ctx,
                "198.51.100.200, 172.18.0.1",
            );
            expect(blocked.status).toBe(429);
        },
    );
});

describe("contract signing", () => {
    integrationTest(
        "records the address nginx saw, not the one the client claimed",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, [
                "contracts:create",
                "contracts:update",
            ]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const pdf = await PDFDocument.create();
            pdf.addPage([595, 842]);
            const fileKey = "test/contract.pdf";
            await ctx.bucket.upload(fileKey, Buffer.from(await pdf.save()), {
                originalFilename: "contract.pdf",
                contentType: "application/pdf",
            });

            const placement = {
                page: 0,
                xPct: 0.16,
                yPct: 0.7,
                wPct: 0.35,
                hPct: 0.09,
            };
            const created = await adminClient.api.contracts.$post({
                json: {
                    title: "Frivillighetskontrakt",
                    version: "2026-01",
                    fileKey,
                    signaturePlacement: placement,
                    namePlacement: { ...placement, yPct: 0.85 },
                },
            });
            const contract = await created.json();
            await adminClient.api.contracts[":id"].activate.$patch({
                param: { id: contract.id },
            });

            const member = await ctx.utils.createTestUser();
            const memberClient = await ctx.utils.clientForUser(member);
            const signed = await memberClient.api.contracts.sign.$post(
                {
                    json: {
                        signedName: "Test Testesen",
                        signatureDataUrl:
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8//8/AzbAxIAD0EYCAFYuAQXf7cwtAAAAAElFTkSuQmCC",
                    },
                },
                {
                    headers: {
                        "x-forwarded-for": `198.51.100.1, ${REAL_CLIENT}`,
                    },
                },
            );
            expect(signed.status).toBe(201);

            const row = await ctx.db.query.contractSignature.findFirst();
            expect(row?.signerIp).toBe(REAL_CLIENT);
        },
    );
});
