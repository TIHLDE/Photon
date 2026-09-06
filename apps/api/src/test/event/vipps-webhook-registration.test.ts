import { schema } from "@photon/db";
import { beforeEach, describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

const OUR_URL = "http://localhost:4000/api/event/payment/webhook";

const registered: { id: string; url: string; events: string[] }[] = [];
const deleted: string[] = [];
let nextId = 0;

vi.mock("@vippsmobilepay/sdk", () => ({
    Client: () => ({
        auth: {
            getToken: vi.fn().mockResolvedValue({
                ok: true,
                data: { access_token: "token", expires_in: "3600" },
            }),
        },
        webhook: {
            list: vi.fn(async () => ({
                ok: true,
                data: { webhooks: [...registered] },
            })),
            register: vi.fn(
                async (_t: string, body: { url: string; events: string[] }) => {
                    const entry = {
                        id: `id-${++nextId}`,
                        url: body.url,
                        events: body.events,
                    };
                    registered.push(entry);
                    return {
                        ok: true,
                        data: { id: entry.id, secret: `secret-${nextId}` },
                    };
                },
            ),
            delete: vi.fn(async (_t: string, id: string) => {
                deleted.push(id);
                const i = registered.findIndex((w) => w.id === id);
                if (i >= 0) registered.splice(i, 1);
                return { ok: true };
            }),
        },
    }),
}));

// `env` er en Proxy uten `ownKeys`, så den kan ikke spres — da forsvinner
// DATABASE_URL og resten. Legg et lag over i stedet.
// Tokenet caches i Redis, som ikke finnes i CI. Det er en ren cache med TTL,
// så en tom en er et gyldig svar — men uten dette ville testen bevist at
// Redis var oppe, ikke at registreringen lagres i basen.
vi.mock("~/lib/cache", () => ({
    getRedis: async () => ({
        get: async () => null,
        set: async () => undefined,
        setEx: async () => undefined,
    }),
}));

vi.mock("@photon/core/env", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photon/core/env")>();
    const overrides: Record<string, unknown> = {
        VIPPS_TEST_MODE: false,
        REFRESH_VIPPS_WEBHOOKS: false,
        WEBHOOK_URL: "http://localhost:4000",
        VIPPS_SUBSCRIPTION_KEY: "k",
        VIPPS_CLIENT_ID: "k",
        VIPPS_CLIENT_SECRET: "k",
        VIPPS_MERCHANT_SERIAL_NUMBER: "1",
    };
    return {
        ...actual,
        env: new Proxy({} as Record<string, unknown>, {
            get: (_, prop: string) =>
                prop in overrides
                    ? overrides[prop]
                    : (actual.env as unknown as Record<string, unknown>)[prop],
        }),
    };
});

beforeEach(() => {
    registered.length = 0;
    deleted.length = 0;
    nextId = 0;
});

describe("Vipps-webhook lagres i basen", () => {
    integrationTest(
        "registrerer én gang og gjenbruker den etter at Redis er tømt",
        async ({ ctx }) => {
            const { setupWebhooks } = await import("~/lib/vipps");

            const first = await setupWebhooks(ctx.db);
            // En omstart tømmer Redis, men ikke basen.
            const second = await setupWebhooks(ctx.db);

            expect(second.id).toBe(first.id);
            expect(second.secret).toBe(first.secret);
            expect(registered).toHaveLength(1);

            const rows = await ctx.db.select().from(schema.vippsWebhook);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.secret).toBe(first.secret);
        },
        500_000,
    );

    integrationTest(
        "rydder bort tidligere registreringer mot vår egen URL, men lar andres stå",
        async ({ ctx }) => {
            const { setupWebhooks } = await import("~/lib/vipps");

            // Slik prod så ut 6. september: registreringer ingen har nøkkelen til.
            registered.push({ id: "gammel-1", url: OUR_URL, events: [] });
            registered.push({ id: "gammel-2", url: OUR_URL, events: [] });
            registered.push({
                id: "annen-integrasjon",
                url: "https://noe-annet.example/webhook",
                events: [],
            });

            const ours = await setupWebhooks(ctx.db);

            expect(deleted).toEqual(["gammel-1", "gammel-2"]);
            expect(registered.map((w) => w.id)).toEqual([
                "annen-integrasjon",
                ours.id,
            ]);
        },
        500_000,
    );
});
