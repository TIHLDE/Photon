import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Allergiene arrangøren trenger for å bestille mat.
 *
 * Det som testes hardest her er tellingen: «har ikke svart» og «har ingen
 * allergier» er to forskjellige svar, og kjøkkenet må ikke lese det ene som
 * det andre.
 */

async function createEvent(ctx: any, slug: string) {
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();

    return await ctx.utils.createTestEvent({
        title: "Immeball",
        slug,
        organizerGroupSlug: "index",
        capacity: 50,
    });
}

/** Melder brukeren på og oppgir allergiene deres direkte i databasen. */
async function joinWithAllergies(
    ctx: any,
    eventId: string,
    userId: string,
    options: {
        slugs?: string[];
        custom?: string[];
        confirmed?: boolean;
    },
) {
    await ctx.db.insert(schema.eventRegistration).values({
        eventId,
        userId,
        status: "registered",
    });

    await ctx.db.insert(schema.userSettings).values({
        userId,
        gender: "other",
        acceptsEventRules: true,
        receiveMailCommunication: true,
        customAllergies: options.custom ?? [],
        allergiesConfirmedAt: options.confirmed ? new Date() : null,
    });

    for (const slug of options.slugs ?? []) {
        await ctx.db.insert(schema.userAllergy).values({
            userId,
            allergySlug: slug,
        });
    }
}

describe("event allergies", () => {
    integrationTest(
        "counts answered, unanswered and allergic participants separately",
        async ({ ctx }) => {
            // `gluten` og `nuts` kommer fra migrasjonen som seeder Mattilsynets
            // 14, så de skal ikke settes inn her.
            const event = await createEvent(ctx, "immeball-tellinger");

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const allergic = await ctx.utils.createTestUser();
            const alsoAllergic = await ctx.utils.createTestUser();
            const none = await ctx.utils.createTestUser();
            const silent = await ctx.utils.createTestUser();

            await joinWithAllergies(ctx, event.id, allergic.id, {
                slugs: ["gluten"],
                custom: ["Bringebær"],
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, alsoAllergic.id, {
                slugs: ["gluten", "nuts"],
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, none.id, {
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, silent.id, {});

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.totalParticipants).toBe(4);
            expect(body.withAllergies).toBe(2);
            expect(body.confirmedNone).toBe(1);
            expect(body.notAnswered).toBe(1);
            // De tre tallene er en oppdeling av deltakerne, ikke tre uavhengige
            // målinger — går de ikke opp, lyver bunnlinja i arrangørfanen.
            expect(
                body.withAllergies + body.confirmedNone + body.notAnswered,
            ).toBe(body.totalParticipants);

            // Gluten står øverst fordi to har det. Fritekst telles ved siden av.
            expect(body.summary[0]).toEqual({
                label: "Glutenholdig korn",
                count: 2,
                custom: false,
            });
            expect(body.summary).toContainEqual({
                label: "Bringebær",
                count: 1,
                custom: true,
            });

            // Bare de som faktisk har oppgitt noe står i lista.
            expect(body.participants.length).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "counts the same free text once regardless of casing",
        async ({ ctx }) => {
            const event = await createEvent(ctx, "immeball-fritekst");

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            await joinWithAllergies(ctx, event.id, first.id, {
                custom: ["Nøtter"],
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, second.id, {
                custom: ["nøtter"],
                confirmed: true,
            });

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            const body = await response.json();
            // Ett kjøkken-relevant tall, ikke to nesten like linjer.
            expect(body.summary).toEqual([
                { label: "Nøtter", count: 2, custom: true },
            ]);
        },
        500_000,
    );

    integrationTest(
        "merges catalogue rows that share a label",
        async ({ ctx }) => {
            // Slik ser Lepton-arven ut: samme allergi importert som to rader
            // fordi fritekstsvarene hadde ulik skrivemåte.
            await ctx.db.insert(schema.allergy).values([
                { slug: "peanotter", label: "Peanøtter" },
                { slug: "peanøtter", label: "Peanøtter" },
            ]);

            const event = await createEvent(ctx, "immeball-duplikater");

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            // Én person har begge radene hengt på seg og skal likevel telle én
            // gang; den andre har den ene.
            await joinWithAllergies(ctx, event.id, first.id, {
                slugs: ["peanotter", "peanøtter"],
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, second.id, {
                slugs: ["peanotter"],
                confirmed: true,
            });

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            const body = await response.json();
            expect(body.summary).toEqual([
                { label: "Peanøtter", count: 2, custom: false },
            ]);
            // Og personraden viser den ikke to ganger.
            const listed = body.participants.find((p) => p.userId === first.id);
            expect(listed?.allergies.length).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "counts a catalogue pick and the same word typed by hand as one",
        async ({ ctx }) => {
            // `nuts` har etiketten «Nøtter» fra migrasjonen.
            const event = await createEvent(ctx, "immeball-blandet");

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const picked = await ctx.utils.createTestUser();
            const typed = await ctx.utils.createTestUser();

            await joinWithAllergies(ctx, event.id, picked.id, {
                slugs: ["nuts"],
                confirmed: true,
            });
            await joinWithAllergies(ctx, event.id, typed.id, {
                custom: ["nøtter"],
                confirmed: true,
            });

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            const body = await response.json();
            // Kjøkkenet bryr seg om at to personer ikke tåler nøtter, ikke om
            // hvordan de svarte.
            expect(body.summary).toEqual([
                { label: "Nøtter", count: 2, custom: false },
            ]);
        },
        500_000,
    );

    integrationTest(
        "leaves out the waitlist and everyone who cancelled",
        async ({ ctx }) => {
            const event = await createEvent(ctx, "immeball-venteliste");

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const attending = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();

            await joinWithAllergies(ctx, event.id, attending.id, {
                custom: ["Gluten"],
                confirmed: true,
            });

            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: waiting.id,
                status: "waitlisted",
            });
            await ctx.db.insert(schema.userSettings).values({
                userId: waiting.id,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
                customAllergies: ["Skalldyr"],
                allergiesConfirmedAt: new Date(),
            });

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            const body = await response.json();
            // Kjøkkenet lager mat til dem som har plass, ikke til køen.
            expect(body.totalParticipants).toBe(1);
            expect(body.summary).toEqual([
                { label: "Gluten", count: 1, custom: true },
            ]);
        },
        500_000,
    );

    integrationTest(
        "a plain member cannot read participant allergies",
        async ({ ctx }) => {
            const event = await createEvent(ctx, "immeball-tilgang");

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[":eventId"].allergies.$get({
                param: { eventId: event.id },
            });

            // Helseopplysninger, så tilgangen følger arrangementet — ikke det
            // at man er innlogget.
            expect(response.status).toBe(403);
        },
        500_000,
    );
});
