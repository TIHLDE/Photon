import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { genderVariants, userAllergy, userSettings } from "../../db/schema";
import type { AppContext } from "../ctx";
import { z } from "zod";

export const UserAllergySchema = z.object({
    slug: z.string(),
    label: z.string(),
    description: z.string().optional(),
});

export const UserSettingsSchema = z.object({
    gender: z.enum(genderVariants),
    allowsPhotosByDefault: z.boolean(),
    acceptsEventRules: z.boolean(),
    imageUrl: z.url({ message: "Must be a valid URL" }).optional(),
    bioDescription: z.string().optional(),
    githubUrl: z.url({ message: "Must be a valid URL" }).optional(),
    linkedinUrl: z.url({ message: "Must be a valid URL" }).optional(),
    receiveMailCommunication: z.boolean(),
    allergies: z.array(z.string()).default([]),
});

export const UpdateUserSettingsSchema = UserSettingsSchema.partial();

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
            bioDescription: settings.bioDescription ?? null,
            githubUrl: settings.githubUrl ?? null,
            linkedinUrl: settings.linkedinUrl ?? null,
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
                    bioDescription: settingsUpdates.bioDescription ?? undefined,
                    githubUrl: settingsUpdates.githubUrl ?? undefined,
                    linkedinUrl: settingsUpdates.linkedinUrl ?? undefined,
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
