import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

async function createStudyPrograms(ctx: IntegrationTestContext) {
    const [dataingenior, digsec] = await ctx.db
        .insert(schema.studyProgram)
        .values([
            {
                displayName: "Dataingeniør",
                feideCode: "BIDATA",
                slug: "dataingenir",
                type: "bachelor",
            },
            {
                displayName: "Digital Infrastruktur og Cybersikkerhet",
                feideCode: "BDIGSEC",
                slug: "digital-infrastruktur-og-cybersikkerhet",
                type: "bachelor",
            },
        ])
        .returning();
    return { dataingenior: dataingenior!, digsec: digsec! };
}

async function editorClient(ctx: IntegrationTestContext) {
    const editor = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(editor, ["master-study:manage"]);
    return ctx.utils.clientForUser(editor);
}

function entryBody(studyProgramId: number, overrides: object = {}) {
    return {
        studyProgramId,
        name: "Informatikk",
        location: "Trondheim",
        locationType: "innland" as const,
        link: "https://www.ntnu.no/studier/mit",
        ...overrides,
    };
}

describe("Master study", () => {
    integrationTest("creates an entry with quotes", async ({ ctx }) => {
        const { dataingenior } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);

        const res = await client.api["master-study"].$post({
            json: {
                ...entryBody(dataingenior.id),
                hasFinancialSupport: true,
                financialSupport: "Lånekassen",
                applicationDeadline: "2027-03-01T22:59:00.000Z",
                quotes: [
                    { name: "Kari", quote: "Anbefales!" },
                    { name: null, quote: "Tøft, men gøy" },
                ],
            },
        });

        expect(res.status).toBe(201);
        const entry = await res.json();
        expect(entry.studyProgram.slug).toBe("dataingenir");
        expect(entry.link).toBe("https://www.ntnu.no/studier/mit");
        expect(entry.applicationDeadline).toBe("2027-03-01T22:59:00.000Z");
        expect(entry.quotes.map((q) => [q.name, q.quote])).toEqual([
            ["Kari", "Anbefales!"],
            [null, "Tøft, men gøy"],
        ]);

        const got = await ctx.utils.client().api["master-study"][":id"].$get({
            param: { id: entry.id },
        });
        expect(got.status).toBe(200);
        expect(await got.json()).toEqual(entry);
    });

    integrationTest("creates an entry without quotes", async ({ ctx }) => {
        const { dataingenior } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);

        const res = await client.api["master-study"].$post({
            json: entryBody(dataingenior.id),
        });

        expect(res.status).toBe(201);
        const entry = await res.json();
        expect(entry.quotes).toEqual([]);
        expect(entry.hasFinancialSupport).toBe(false);
        expect(entry.applicationDeadline).toBeNull();
    });

    integrationTest("rejects invalid create input", async ({ ctx }) => {
        const { dataingenior } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);
        const post = (json: object) =>
            client.api["master-study"].$post({
                json: json as ReturnType<typeof entryBody>,
            });

        const { link: _, ...withoutLink } = entryBody(dataingenior.id);
        expect((await post(withoutLink)).status).toBe(400);

        for (const link of [
            "not a url",
            "ftp://ntnu.no/fil",
            "javascript:alert(1)",
        ]) {
            expect(
                (await post(entryBody(dataingenior.id, { link }))).status,
            ).toBe(400);
        }

        expect((await post(entryBody(9999))).status).toBe(400);

        expect(
            (
                await post(
                    entryBody(dataingenior.id, {
                        financialSupport: "Stipend",
                    }),
                )
            ).status,
        ).toBe(400);

        expect(await ctx.db.$count(schema.masterStudyEntry)).toBe(0);
    });

    integrationTest(
        "lists with filters, search and paging",
        async ({ ctx }) => {
            const { dataingenior, digsec } = await createStudyPrograms(ctx);
            const client = await editorClient(ctx);
            const create = async (json: object) => {
                const res = await client.api["master-study"].$post({
                    json: json as ReturnType<typeof entryBody>,
                });
                expect(res.status).toBe(201);
                return res.json();
            };

            const a = await create(
                entryBody(dataingenior.id, { name: "Informatikk" }),
            );
            const b = await create(
                entryBody(dataingenior.id, {
                    name: "Computer Science",
                    location: "Delft",
                    locationType: "utland",
                    hasFinancialSupport: true,
                }),
            );
            const c = await create(
                entryBody(digsec.id, {
                    name: "Informasjonssikkerhet",
                    location: "Gjøvik",
                    summary: "Nettverk og kryptografi",
                }),
            );

            const list = async (query: Record<string, string>) => {
                const res = await ctx.utils.client().api["master-study"].$get({
                    query,
                });
                expect(res.status).toBe(200);
                return res.json();
            };
            const ids = async (query: Record<string, string>) =>
                (await list(query)).items.map((e) => e.id);

            // Newest update first.
            expect(await ids({})).toEqual([c.id, b.id, a.id]);

            expect(await ids({ locationType: "utland" })).toEqual([b.id]);
            expect(await ids({ studyProgramId: String(digsec.id) })).toEqual([
                c.id,
            ]);
            expect(await ids({ hasFinancialSupport: "true" })).toEqual([b.id]);
            expect(await ids({ hasFinancialSupport: "false" })).toEqual([
                c.id,
                a.id,
            ]);
            expect(await ids({ search: "DELFT" })).toEqual([b.id]);
            expect(await ids({ search: "krypto" })).toEqual([c.id]);
            expect(
                await ids({
                    studyProgramId: String(dataingenior.id),
                    locationType: "innland",
                    hasFinancialSupport: "false",
                    search: "info",
                }),
            ).toEqual([a.id]);

            const bad = await ctx.utils.client().api["master-study"].$get({
                query: { hasFinancialSupport: "nope" },
            });
            expect(bad.status).toBe(400);

            const page0 = await list({ pageSize: "2", page: "0" });
            expect(page0).toMatchObject({
                totalCount: 3,
                pages: 2,
                nextPage: 1,
            });
            expect(page0.items).toHaveLength(2);
            const page1 = await list({ pageSize: "2", page: "1" });
            expect(page1.nextPage).toBeNull();
            expect(page1.items.map((e) => e.id)).toEqual([a.id]);
        },
    );

    integrationTest(
        "lists study programs with entry counts",
        async ({ ctx }) => {
            const { dataingenior, digsec } = await createStudyPrograms(ctx);
            const client = await editorClient(ctx);
            await client.api["master-study"].$post({
                json: entryBody(dataingenior.id),
            });

            const res = await ctx.utils
                .client()
                .api["master-study"]["study-programs"].$get();
            expect(res.status).toBe(200);
            const counts = Object.fromEntries(
                (await res.json()).map((p) => [p.id, p.entryCount]),
            );
            expect(counts).toEqual({ [dataingenior.id]: 1, [digsec.id]: 0 });
        },
    );

    integrationTest("returns 404 for an unknown entry", async ({ ctx }) => {
        const res = await ctx.utils.client().api["master-study"][":id"].$get({
            param: { id: UNKNOWN_ID },
        });
        expect(res.status).toBe(404);
    });

    integrationTest("updates an entry", async ({ ctx }) => {
        const { dataingenior, digsec } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);
        const created = await (
            await client.api["master-study"].$post({
                json: {
                    ...entryBody(dataingenior.id),
                    hasFinancialSupport: true,
                    financialSupport: "Stipend",
                    summary: "Kort om studiet",
                    applicationDeadline: "2027-03-01T22:59:00.000Z",
                    quotes: [{ name: "Ola", quote: "Gammelt sitat" }],
                },
            })
        ).json();
        const patch = (json: object) =>
            client.api["master-study"][":id"].$patch({
                param: { id: created.id },
                json,
            });

        // A single field; the rest stays put.
        const renamed = await patch({ name: "Datateknologi" });
        expect(renamed.status).toBe(200);
        const renamedBody = await renamed.json();
        expect(renamedBody.name).toBe("Datateknologi");
        expect(renamedBody.summary).toBe("Kort om studiet");
        expect(renamedBody.quotes).toHaveLength(1);
        expect(new Date(renamedBody.updatedAt).getTime()).toBeGreaterThan(
            new Date(created.updatedAt).getTime(),
        );

        // Replacing quotes alone still moves updatedAt.
        const replaced = await (
            await patch({
                quotes: [
                    { name: null, quote: "Nytt 1" },
                    { name: "Per", quote: "Nytt 2" },
                ],
            })
        ).json();
        expect(replaced.quotes.map((q) => q.quote)).toEqual([
            "Nytt 1",
            "Nytt 2",
        ]);
        expect(new Date(replaced.updatedAt).getTime()).toBeGreaterThan(
            new Date(renamedBody.updatedAt).getTime(),
        );

        // Clearing nullable fields.
        const cleared = await (
            await patch({ summary: null, applicationDeadline: null })
        ).json();
        expect(cleared.summary).toBeNull();
        expect(cleared.applicationDeadline).toBeNull();

        // Turning financial support off clears the details.
        const noSupport = await (
            await patch({ hasFinancialSupport: false })
        ).json();
        expect(noSupport.financialSupport).toBeNull();
        expect((await patch({ financialSupport: "Igjen" })).status).toBe(400);
        expect(
            (
                await patch({
                    hasFinancialSupport: false,
                    financialSupport: "Stipend",
                })
            ).status,
        ).toBe(400);

        expect((await patch({ link: null })).status).toBe(400);

        // Any website will do, not just ntnu.no.
        const external = await (
            await patch({ link: "https://www.uio.no/studier/master" })
        ).json();
        expect(external.link).toBe("https://www.uio.no/studier/master");
        expect((await patch({ name: null })).status).toBe(400);
        expect((await patch({ studyProgramId: 9999 })).status).toBe(400);

        const moved = await (await patch({ studyProgramId: digsec.id })).json();
        expect(moved.studyProgram.id).toBe(digsec.id);

        const missing = await client.api["master-study"][":id"].$patch({
            param: { id: UNKNOWN_ID },
            json: { name: "x" },
        });
        expect(missing.status).toBe(404);
    });

    integrationTest("deletes an entry with its quotes", async ({ ctx }) => {
        const { dataingenior } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);
        const created = await (
            await client.api["master-study"].$post({
                json: {
                    ...entryBody(dataingenior.id),
                    quotes: [{ name: "Kari", quote: "Hei" }],
                },
            })
        ).json();

        const res = await client.api["master-study"][":id"].$delete({
            param: { id: created.id },
        });
        expect(res.status).toBe(200);
        expect(
            await ctx.db.$count(
                schema.masterStudyQuote,
                eq(schema.masterStudyQuote.entryId, created.id),
            ),
        ).toBe(0);

        const again = await client.api["master-study"][":id"].$delete({
            param: { id: created.id },
        });
        expect(again.status).toBe(404);
    });

    integrationTest("manages single quotes", async ({ ctx }) => {
        const { dataingenior } = await createStudyPrograms(ctx);
        const client = await editorClient(ctx);
        const post = async () =>
            (
                await client.api["master-study"].$post({
                    json: {
                        ...entryBody(dataingenior.id),
                        quotes: [{ name: "Kari", quote: "Første" }],
                    },
                })
            ).json();
        const entry = await post();
        const other = await post();
        const quotes = client.api["master-study"][":entryId"].quotes;

        const added = await quotes.$post({
            param: { entryId: entry.id },
            json: { quote: "Andre" },
        });
        expect(added.status).toBe(201);
        const addedQuote = await added.json();
        expect(addedQuote.name).toBeNull();

        const afterAdd = await (
            await ctx.utils.client().api["master-study"][":id"].$get({
                param: { id: entry.id },
            })
        ).json();
        expect(afterAdd.quotes.map((q) => q.quote)).toEqual([
            "Første",
            "Andre",
        ]);

        const named = await quotes[":quoteId"].$patch({
            param: { entryId: entry.id, quoteId: addedQuote.id },
            json: { name: "Per", quote: "Endret" },
        });
        expect(await named.json()).toEqual({
            id: addedQuote.id,
            name: "Per",
            quote: "Endret",
        });

        const anonymous = await quotes[":quoteId"].$patch({
            param: { entryId: entry.id, quoteId: addedQuote.id },
            json: { name: null },
        });
        expect((await anonymous.json()).name).toBeNull();

        // A quote addressed through the wrong entry does not exist.
        const wrongEntry = await quotes[":quoteId"].$patch({
            param: { entryId: other.id, quoteId: addedQuote.id },
            json: { quote: "Kapret" },
        });
        expect(wrongEntry.status).toBe(404);
        const wrongDelete = await quotes[":quoteId"].$delete({
            param: { entryId: other.id, quoteId: addedQuote.id },
        });
        expect(wrongDelete.status).toBe(404);

        const missingEntry = await quotes.$post({
            param: { entryId: UNKNOWN_ID },
            json: { quote: "Hei" },
        });
        expect(missingEntry.status).toBe(404);

        const deleted = await quotes[":quoteId"].$delete({
            param: { entryId: entry.id, quoteId: addedQuote.id },
        });
        expect(deleted.status).toBe(200);
        expect(
            await ctx.db.$count(
                schema.masterStudyQuote,
                eq(schema.masterStudyQuote.entryId, entry.id),
            ),
        ).toBe(1);
    });

    integrationTest(
        "write endpoints need login and permission",
        async ({ ctx }) => {
            const { dataingenior } = await createStudyPrograms(ctx);
            const editor = await editorClient(ctx);
            const entry = await (
                await editor.api["master-study"].$post({
                    json: {
                        ...entryBody(dataingenior.id),
                        quotes: [{ name: "Kari", quote: "Hei" }],
                    },
                })
            ).json();
            const quoteId = entry.quotes[0]!.id;

            const updater = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(updater, [
                "master-study:update",
            ]);

            const clients = {
                anonymous: ctx.utils.client(),
                member: await ctx.utils.clientForUser(
                    await ctx.utils.createTestUser(),
                ),
            };
            const expected = { anonymous: 401, member: 403 } as const;

            for (const [who, client] of Object.entries(clients)) {
                const api = client.api["master-study"];
                const responses = [
                    await api.$post({ json: entryBody(dataingenior.id) }),
                    await api[":id"].$patch({
                        param: { id: entry.id },
                        json: { name: "x" },
                    }),
                    await api[":id"].$delete({ param: { id: entry.id } }),
                    await api[":entryId"].quotes.$post({
                        param: { entryId: entry.id },
                        json: { quote: "x" },
                    }),
                    await api[":entryId"].quotes[":quoteId"].$patch({
                        param: { entryId: entry.id, quoteId },
                        json: { quote: "x" },
                    }),
                    await api[":entryId"].quotes[":quoteId"].$delete({
                        param: { entryId: entry.id, quoteId },
                    }),
                ];
                expect(
                    responses.map((r) => r.status),
                    who,
                ).toEqual(
                    responses.map(() => expected[who as keyof typeof expected]),
                );
            }

            // Deleting a quote is a delete, not an update.
            const updaterClient = await ctx.utils.clientForUser(updater);
            const quoteDelete = await updaterClient.api["master-study"][
                ":entryId"
            ].quotes[":quoteId"].$delete({
                param: { entryId: entry.id, quoteId },
            });
            expect(quoteDelete.status).toBe(403);
        },
    );
});
