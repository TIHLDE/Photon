import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    UserSettingsSchema,
    UpdateUserSettingsSchema,
} from "~/lib/user/settings";

// ===== RESPONSE SCHEMAS =====

export const allergySchema = Schema(
    "Allergy",
    z.object({
        slug: z.string().meta({
            description: "Unique identifier for the allergy",
        }),
        label: z.string().meta({
            description: "Display name of the allergy",
        }),
        description: z.string().nullable().meta({
            description: "Detailed description of the allergy",
        }),
    }),
);

export const allergiesListSchema = Schema(
    "AllergyList",
    z.array(allergySchema),
);

export const userSettingsResponseSchema = Schema(
    "UserSettings",
    UserSettingsSchema.extend({
        isOnboarded: z.boolean().meta({
            description: "Whether the user has completed onboarding",
        }),
    }),
);

export const userSettingsSchema = Schema("UserSettingsBase", UserSettingsSchema);

export const updateUserSettingsResponseSchema = Schema(
    "UpdateUserSettings",
    UpdateUserSettingsSchema,
);
