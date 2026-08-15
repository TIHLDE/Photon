import { genderVariants, userAllergy, userSettings } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { promoteAssetUrls } from "../asset";
import type { AppContext } from "../ctx";

export const UserAllergySchema = z.object({
    slug: z.string(),
    label: z.string(),
    description: z.string().optional(),
});

/**
 * A profile link the user can clear again. Omitting the field leaves it
 * untouched; an empty string is an explicit "remove this link" and is stored as
 * NULL — without it there would be no way to undo a link once it was set.
 */
const clearableUrl = z
    .union([z.url({ message: "Must be a valid URL" }), z.literal("")])
    .optional();

export const UserSettingsSchema = z.object({
    gender: z.enum(genderVariants),
    allowsPhotosByDefault: z.boolean(),
    acceptsEventRules: z.boolean(),
    imageUrl: z.url({ message: "Must be a valid URL" }).optional(),
    bioDescription: z.string().optional(),
    githubUrl: clearableUrl,
    linkedinUrl: clearableUrl,
    receiveMailCommunication: z.boolean(),
    // Defaulted rather than required: onboarding clients predate the setting,
    // and «vis meg i deltakerlister» is how påmeldinger have always worked.
    publicEventRegistrations: z.boolean().default(true),
    allergies: z.array(z.string()).default([]),
});

/** Tomme strenger lagres som NULL, så «tømt felt» ikke blir en tom verdi i DB. */
function emptyToNull<T extends string>(value: T | undefined) {
    return value === undefined ? undefined : value === "" ? null : value;
}

// `allergies` har `.default([])`, som overlever `.partial()` og gjør feltet
// påkrevd for klientene. Uten dette måtte enhver delvis oppdatering sende
// allergiene på nytt — glemmer den det, tømmes de.
export const UpdateUserSettingsSchema = UserSettingsSchema.partial().extend({
    allergies: z.array(z.string()).optional(),
    publicEventRegistrations: z.boolean().optional(),
});

export type UserAllergy = z.infer<typeof UserAllergySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;

/**
 * Fallbacks for the columns that are `NOT NULL` but that a partial update need
 * not carry, used when a user updates a single setting before they have a
 * settings row at all — which is the normal state, since nothing creates the
 * row at sign-up. Without them a new member could never accept the event rules,
 * as the only paths to a row were full onboarding or the Lepton migration.
 *
 * `isOnboarded` stays false, so these placeholders are recognisable as "never
 * answered" rather than "answered like this".
 *
 * `allowsPhotosByDefault` is true to match what påmeldingen already does for a
 * member without a row (`?? true` in the registration route). Otherwise the row
 * this creates would silently revoke their photo consent the moment they
 * accepted the event rules — two unrelated settings, one click.
 */
const IMPLICIT_SETTINGS_DEFAULTS = {
    gender: "other",
    allowsPhotosByDefault: true,
    acceptsEventRules: false,
    receiveMailCommunication: true,
    publicEventRegistrations: true,
    isOnboarded: false,
} as const;

/**
 * Whether the user has accepted the event rules.
 *
 * No settings row means they never answered, which counts as "not accepted" —
 * the rules are an active choice, so the absence of one can't grant it.
 */
export async function hasAcceptedEventRules(
    userId: string,
    ctx: AppContext,
): Promise<boolean> {
    const settings = await ctx.db.query.userSettings.findFirst({
        where: (s, { eq }) => eq(s.userId, userId),
        columns: { acceptsEventRules: true },
    });

    return settings?.acceptsEventRules ?? false;
}

export async function getUserSettings(
    userId: string,
    ctx: AppContext,
): Promise<UserSettings | null> {
    const { db } = ctx;

    const settingsWithAllergies = await db.query.userSettings.findFirst({
        where: (settings, { eq }) => eq(settings.userId, userId),
        with: {
            allergies: {
                columns: {
                    allergySlug: true,
                },
            },
        },
    });

    if (!settingsWithAllergies) {
        return null;
    }

    return {
        acceptsEventRules: settingsWithAllergies.acceptsEventRules,
        allowsPhotosByDefault: settingsWithAllergies.allowsPhotosByDefault,
        bioDescription: settingsWithAllergies.bioDescription ?? undefined,
        gender: settingsWithAllergies.gender,
        githubUrl: settingsWithAllergies.githubUrl ?? undefined,
        imageUrl: settingsWithAllergies.imageUrl ?? undefined,
        linkedinUrl: settingsWithAllergies.linkedinUrl ?? undefined,
        receiveMailCommunication:
            settingsWithAllergies.receiveMailCommunication,
        publicEventRegistrations:
            settingsWithAllergies.publicEventRegistrations,
        allergies: settingsWithAllergies.allergies.map((ua) => ua.allergySlug),
    };
}

export async function createUserSettings(
    userId: string,
    settings: UserSettings,
    ctx: AppContext,
): Promise<UserSettings> {
    const { db } = ctx;

    // The profile picture is staged until a row claims it; without this the
    // cleanup cron deletes the file after two days.
    await promoteAssetUrls(ctx.bucket, [settings.imageUrl]);

    // Use transaction for atomicity
    return await db.transaction(async (tx) => {
        const values = {
            gender: settings.gender,
            allowsPhotosByDefault: settings.allowsPhotosByDefault,
            acceptsEventRules: settings.acceptsEventRules,
            imageUrl: settings.imageUrl ?? null,
            bioDescription: emptyToNull(settings.bioDescription) ?? null,
            githubUrl: emptyToNull(settings.githubUrl) ?? null,
            linkedinUrl: emptyToNull(settings.linkedinUrl) ?? null,
            receiveMailCommunication: settings.receiveMailCommunication,
            publicEventRegistrations: settings.publicEventRegistrations,
            isOnboarded: true, // Mark as onboarded when creating
        };

        // Onboarding overwrites any placeholder row left behind by an earlier
        // single-setting update (accepting the event rules creates one), so
        // answering the real questions is never blocked by it.
        await tx
            .insert(userSettings)
            .values({ ...values, userId })
            .onConflictDoUpdate({ target: userSettings.userId, set: values });

        // Set allergies
        if (settings.allergies.length > 0) {
            await tx.insert(userAllergy).values(
                settings.allergies.map((slug) => ({
                    userId,
                    allergySlug: slug,
                })),
            );
        }

        return {
            ...settings,
            allergies: settings.allergies,
        };
    });
}

export async function updateUserSettings(
    userId: string,
    updates: UpdateUserSettings,
    ctx: AppContext,
): Promise<UserSettings> {
    const { db } = ctx;

    await promoteAssetUrls(ctx.bucket, [updates.imageUrl]);

    return await db.transaction(async (tx) => {
        // Separate allergies from other updates
        const { allergies, ...settingsUpdates } = updates;

        // Update settings if there are any field updates
        if (Object.keys(settingsUpdates).length > 0) {
            const values = {
                ...settingsUpdates,
                imageUrl: settingsUpdates.imageUrl ?? undefined,
                bioDescription: emptyToNull(settingsUpdates.bioDescription),
                githubUrl: emptyToNull(settingsUpdates.githubUrl),
                linkedinUrl: emptyToNull(settingsUpdates.linkedinUrl),
            };

            // Upsert rather than update: members who never onboarded have no
            // row, and a plain UPDATE silently matched nothing — so accepting
            // the event rules appeared to work and changed nothing.
            await tx
                .insert(userSettings)
                .values({
                    ...IMPLICIT_SETTINGS_DEFAULTS,
                    ...values,
                    userId,
                })
                .onConflictDoUpdate({
                    target: userSettings.userId,
                    set: values,
                });
        }

        // Update allergies if provided
        if (allergies !== undefined) {
            // `user_setting_allergy.user_id` points at the settings row, not
            // at the user, so allergies cannot be written for a member who
            // never onboarded — and an update carrying nothing but allergies
            // skips the upsert above.
            await ensureUserSettingsRow(userId, { ...ctx, db: tx });
            await setUserAllergies(userId, allergies, { ...ctx, db: tx });
        }

        // Fetch and return updated settings
        const updated = await tx.query.userSettings.findFirst({
            where: (settings, { eq }) => eq(settings.userId, userId),
            with: {
                allergies: {
                    columns: {
                        allergySlug: true,
                    },
                },
            },
        });

        if (!updated) {
            throw new HTTPException(404, {
                message: "User settings not found",
            });
        }

        return {
            acceptsEventRules: updated.acceptsEventRules,
            allowsPhotosByDefault: updated.allowsPhotosByDefault,
            bioDescription: updated.bioDescription ?? undefined,
            gender: updated.gender,
            githubUrl: updated.githubUrl ?? undefined,
            imageUrl: updated.imageUrl ?? undefined,
            linkedinUrl: updated.linkedinUrl ?? undefined,
            receiveMailCommunication: updated.receiveMailCommunication,
            publicEventRegistrations: updated.publicEventRegistrations,
            allergies: updated.allergies.map((ua) => ua.allergySlug),
        };
    });
}

/**
 * Make sure the member has a settings row, without changing one that exists.
 *
 * Rows are only created by onboarding, by the Lepton migration, or by an
 * update that carries a settings field — so most migrated members have none.
 * Anything with a foreign key into `user_settings` has to call this first.
 */
export async function ensureUserSettingsRow(
    userId: string,
    ctx: AppContext,
): Promise<void> {
    await ctx.db
        .insert(userSettings)
        .values({ ...IMPLICIT_SETTINGS_DEFAULTS, userId })
        .onConflictDoNothing({ target: userSettings.userId });
}

export async function setUserAllergies(
    userId: string,
    allergySlugs: string[],
    ctx: AppContext,
): Promise<void> {
    const { db } = ctx;

    // Delete existing allergies
    await db.delete(userAllergy).where(eq(userAllergy.userId, userId));

    // Insert new allergies if any
    if (allergySlugs.length > 0) {
        await db.insert(userAllergy).values(
            allergySlugs.map((slug) => ({
                userId,
                allergySlug: slug,
            })),
        );
    }
}
