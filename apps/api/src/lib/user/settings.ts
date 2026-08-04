import { genderVariants, userAllergy, userSettings } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
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
});

export type UserAllergy = z.infer<typeof UserAllergySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;

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
        allergies: settingsWithAllergies.allergies.map((ua) => ua.allergySlug),
    };
}

export async function createUserSettings(
    userId: string,
    settings: UserSettings,
    ctx: AppContext,
): Promise<UserSettings> {
    const { db } = ctx;

    // Use transaction for atomicity
    return await db.transaction(async (tx) => {
        // Create settings
        await tx.insert(userSettings).values({
            userId,
            gender: settings.gender,
            allowsPhotosByDefault: settings.allowsPhotosByDefault,
            acceptsEventRules: settings.acceptsEventRules,
            imageUrl: settings.imageUrl ?? null,
            bioDescription: emptyToNull(settings.bioDescription) ?? null,
            githubUrl: emptyToNull(settings.githubUrl) ?? null,
            linkedinUrl: emptyToNull(settings.linkedinUrl) ?? null,
            receiveMailCommunication: settings.receiveMailCommunication,
            isOnboarded: true, // Mark as onboarded when creating
        });

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

    return await db.transaction(async (tx) => {
        // Separate allergies from other updates
        const { allergies, ...settingsUpdates } = updates;

        // Update settings if there are any field updates
        if (Object.keys(settingsUpdates).length > 0) {
            await tx
                .update(userSettings)
                .set({
                    ...settingsUpdates,
                    imageUrl: settingsUpdates.imageUrl ?? undefined,
                    bioDescription: emptyToNull(settingsUpdates.bioDescription),
                    githubUrl: emptyToNull(settingsUpdates.githubUrl),
                    linkedinUrl: emptyToNull(settingsUpdates.linkedinUrl),
                })
                .where(eq(userSettings.userId, userId));
        }

        // Update allergies if provided
        if (allergies !== undefined) {
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
            allergies: updated.allergies.map((ua) => ua.allergySlug),
        };
    });
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
