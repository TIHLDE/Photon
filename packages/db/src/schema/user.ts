import {
    boolean,
    pgEnum,
    pgTableCreator,
    primaryKey,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `user_${name}`);

// ===== ENUMS =====

export const genderVariants = ["male", "female", "other"] as const;

export const gender = pgEnum("user_gender", genderVariants);

export type Gender = (typeof genderVariants)[number];

// ===== TABLES =====

export const userSettings = pgTable("settings", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, {
            name: "user_settings_user_id_auth_user_id_fk",
            onDelete: "cascade",
        }),
    gender: gender("gender").notNull(),
    allowsPhotosByDefault: boolean("allows_photos_by_default")
        .default(false)
        .notNull(),
    acceptsEventRules: boolean("accepts_event_rules").notNull(),
    imageUrl: text("image_url"),
    bioDescription: text("bio_description"),
    githubUrl: varchar("github_url", { length: 256 }),
    linkedinUrl: varchar("linkedin_url", { length: 256 }),
    receiveMailCommunication: boolean("receive_mail_communication").notNull(),
    isOnboarded: boolean("is_onboarded").default(false).notNull(),
    ...timestamps,
    /**
     * Whether the member is listed by name in deltakerlister. Off means they
     * still register as normal, but other members see them as anonymous.
     * Defaults to true to match how påmeldinger have always been shown.
     */
    publicEventRegistrations: boolean("public_event_registrations")
        .default(true)
        .notNull(),
    /**
     * Allergier medlemmet har skrevet inn selv, i tillegg til avhukingene i
     * `user_allergy`. De ligger her og ikke i katalogen fordi Lepton-importen
     * la hvert eneste fritekstsvar inn som sin egen katalograd — det ga oss
     * ~200 nesten like rader, og katalogen ville blitt ubrukelig som liste å
     * velge fra hvis alle nye fritekstsvar havnet der også.
     */
    customAllergies: text("custom_allergies").array().default([]).notNull(),
    /**
     * Når medlemmet sist svarte på allergispørsmålet — også når svaret var
     * «ingen». NULL betyr «har aldri svart», og det er hele poenget: uten
     * dette kan ikke en arrangør skille de allergifrie fra de som bare ikke
     * har sett spørsmålet, og kjøkkenet ender med å gjette.
     *
     * Settes kun når medlemmet lagrer selv. En admin som fyller inn på vegne
     * av noen er ikke en bekreftelse fra medlemmet.
     */
    allergiesConfirmedAt: timestamp("allergies_confirmed_at"),
});
/**
 * Hemmelig nøkkel som gir tilgang til brukerens egen kalenderstrøm
 * (`/api/event/calendar/:token/events.ics`). Kalenderklienter kan ikke logge
 * inn, så URL-en må bære autentiseringen selv. Nøkkelen ligger i sin egen
 * tabell — ikke på `user_settings` — fordi den skal kunne rulleres uten å
 * røre innstillingene, og fordi brukere uten fullført onboarding ikke har
 * en settings-rad.
 */
export const userCalendarToken = pgTable("calendar_token", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, {
            name: "user_calendar_token_user_id_auth_user_id_fk",
            onDelete: "cascade",
        }),
    token: varchar("token", { length: 64 })
        .notNull()
        .unique("user_calendar_token_token_unique"),
    ...timestamps,
});

export const allergy = pgTable("allergy", {
    slug: varchar("slug", { length: 64 }).primaryKey(),
    label: varchar("label", { length: 128 }).notNull(),
    description: text("description"),
    /**
     * Om raden er en av de kuraterte vi selv har seedet, og dermed noe vi vil
     * tilby i nedtrekkslista. Radene Lepton-importen laget står som `false`:
     * de vises fortsatt der de allerede er koblet til et medlem, men de skal
     * ikke fylle opp lista for alle andre.
     */
    curated: boolean("curated").default(false).notNull(),
});
export const userAllergy = pgTable(
    "user_setting_allergy",
    {
        userId: text("user_id")
            .notNull()
            .references(() => userSettings.userId, {
                name: "user_user_setting_allergy_user_id_user_settings_user_id_fk",
                onDelete: "cascade",
            }),
        allergySlug: varchar("allergy_slug", { length: 64 })
            .notNull()
            .references(() => allergy.slug, {
                name: "user_user_setting_allergy_allergy_slug_user_allergy_slug_fk",
                onDelete: "cascade",
            }),
        ...timestamps,
    },
    (t) => [
        primaryKey({
            name: "user_user_setting_allergy_user_id_allergy_slug_pk",
            columns: [t.userId, t.allergySlug],
        }),
    ],
);
