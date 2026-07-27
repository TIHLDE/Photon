import z from "zod";
import { Schema } from "~/lib/openapi";
import { PagniationResponseSchema } from "~/middleware/pagination";
import {
    UpdateUserSettingsSchema,
    UserSettingsSchema,
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

export const userSettingsSchema = Schema(
    "UserSettingsBase",
    UserSettingsSchema,
);

export const onboardUserInputSchema = Schema(
    "OnboardUserInput",
    UserSettingsSchema,
);

export const updateUserSettingsInputSchema = Schema(
    "UpdateUserSettingsInput",
    UpdateUserSettingsSchema,
);

export const updateUserSettingsResponseSchema = Schema(
    "UpdateUserSettings",
    UpdateUserSettingsSchema,
);

/** Sentinel for "no study programme" in the `study` filter. */
export const NO_STUDY_FILTER = "none";

export const userListQuerySchema = z.object({
    search: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional()
        .meta({ description: "Filter by name or username (substring)" }),
    study: z
        .string()
        .max(128)
        .optional()
        .meta({
            description: `Slug of a STUDY group to filter by, or "${NO_STUDY_FILTER}" for users without one`,
        }),
    studyStartYear: z.coerce.number().int().optional().meta({
        description: "Filter by cohort (STUDYYEAR group), e.g. 2023",
    }),
});

export const userListItemSchema = Schema(
    "UserListItem",
    z.object({
        id: z.string().meta({ description: "User ID" }),
        name: z.string().meta({ description: "User display name" }),
        username: z.string().nullable().meta({ description: "Username" }),
        image: z.string().nullable().meta({ description: "Profile image URL" }),
        studyProgram: z.string().nullable().meta({
            description:
                "Name of the user's study programme, derived from their STUDY group membership. Null when they have none.",
        }),
        studyStartYear: z.number().int().nullable().meta({
            description:
                "The year the user started studying (kull), derived from their STUDYYEAR group membership. Null when unknown.",
        }),
        createdAt: z
            .string()
            .meta({ description: "Account creation timestamp" }),
    }),
);

export const userListResponseSchema = Schema(
    "UserList",
    PagniationResponseSchema.extend({
        items: z.array(userListItemSchema),
    }),
);
