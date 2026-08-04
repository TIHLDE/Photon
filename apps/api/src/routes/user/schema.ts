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

export const unansweredEvaluationsSchema = Schema(
    "UnansweredEvaluations",
    z.array(
        z.object({
            formId: z.string().meta({ description: "Form to answer" }),
            formTitle: z.string(),
            eventId: z.string(),
            eventTitle: z.string(),
            eventEndTime: z
                .string()
                .meta({ description: "When the event ended" }),
        }),
    ),
);

/**
 * Bounds on a hand-entered cohort year.
 *
 * The same window `parseValidStudyPrograms` accepts from Feide, so a
 * correction cannot express an intake the sync would have rejected.
 */
const MIN_COHORT_YEAR = 2000;
const MAX_COHORT_YEAR = 3000;

export const updateStudyYearInputSchema = Schema(
    "UpdateStudyYearInput",
    z.object({
        startYear: z
            .number()
            .int()
            .min(MIN_COHORT_YEAR)
            .max(MAX_COHORT_YEAR)
            .nullable()
            .meta({
                description:
                    "Cohort start year, e.g. 2026. Null clears the cohort and removes the member's STUDYYEAR group.",
            }),
    }),
);

export const updateStudyYearResponseSchema = Schema(
    "UpdateStudyYear",
    z.object({
        message: z.string(),
        startYear: z
            .number()
            .int()
            .nullable()
            .meta({ description: "The cohort year now stored" }),
    }),
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

/**
 * What one member may see about another. Deliberately excludes e-mail, gender,
 * allergies and notification settings — those belong to the session, not to a
 * profile page someone else is looking at.
 */
export const userProfileSchema = Schema(
    "UserProfile",
    z.object({
        id: z.string().meta({ description: "User ID" }),
        name: z.string().meta({ description: "User display name" }),
        username: z.string().nullable().meta({ description: "Username" }),
        image: z.string().nullable().meta({
            description:
                "Profile image URL — the uploaded avatar when there is one, otherwise the one from Feide",
        }),
        bio: z.string().nullable().meta({ description: "Free-text bio" }),
        githubUrl: z
            .string()
            .nullable()
            .meta({ description: "Link to the user's GitHub profile" }),
        linkedinUrl: z
            .string()
            .nullable()
            .meta({ description: "Link to the user's LinkedIn profile" }),
        studyProgram: z.string().nullable().meta({
            description:
                "Name of the user's study programme, derived from their STUDY group membership. Null when they have none.",
        }),
        studyStartYear: z.number().int().nullable().meta({
            description:
                "The year the user started studying (kull), derived from their STUDYYEAR group membership. Null when unknown.",
        }),
        groups: z
            .array(
                z.object({
                    slug: z.string(),
                    name: z.string(),
                    type: z.string(),
                    logoUrl: z.string().nullable(),
                    role: z.string(),
                }),
            )
            .meta({
                description:
                    "Every group the user belongs to, including the derived STUDY/STUDYYEAR groups",
            }),
        formerGroups: z
            .array(
                z.object({
                    slug: z.string(),
                    name: z.string(),
                    type: z.string(),
                    logoUrl: z.string().nullable(),
                    role: z.string(),
                    startedAt: z.string(),
                    endedAt: z.string(),
                }),
            )
            .meta({
                description:
                    "Groups the user used to belong to, most recent first. Groups they rejoined appear under `groups` instead, and a group left more than once is listed once, by the latest stint. As public as the active memberships above.",
            }),
        createdAt: z
            .string()
            .meta({ description: "Account creation timestamp" }),
    }),
);
