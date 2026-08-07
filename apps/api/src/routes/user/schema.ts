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

export const setPasswordInputSchema = Schema(
    "SetPasswordInput",
    z.object({
        newPassword: z.string().meta({
            description:
                "The password to set. Length is checked against Better Auth's own bounds, since those are what sign-in enforces.",
        }),
    }),
);

export const setPasswordResponseSchema = Schema(
    "SetPasswordResponse",
    z.object({
        success: z.boolean(),
    }),
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
 * An admin edits allergies and nothing else about the profile.
 *
 * Everything else in {@link UpdateUserSettingsSchema} — gender, bio, links,
 * mail preferences — is the member's own answer, and `acceptsEventRules` is a
 * consent nobody can give on their behalf. Allergies are the exception because
 * they are read by whoever orders the food: a member who wrote nonsense, or
 * whose allergies changed while they were unreachable, is an arrangør's
 * problem to fix.
 */
export const updateUserAllergiesInputSchema = Schema(
    "UpdateUserAllergiesInput",
    z.object({
        allergies: z.array(z.string().max(64)).max(50).meta({
            description:
                "Allergy slugs the member should have. Replaces the current set.",
        }),
    }),
);

export const userAllergiesResponseSchema = Schema(
    "UserAllergies",
    z.object({
        allergies: z.array(allergySchema),
    }),
);

export const updateUserStatusInputSchema = Schema(
    "UpdateUserStatusInput",
    z.object({
        isActive: z.boolean().meta({
            description:
                "False deactivates the account: the member can no longer sign in, and their sessions are ended.",
        }),
        reason: z.string().max(500).optional().meta({
            description:
                "Why the account was deactivated. Ignored when activating.",
        }),
    }),
);

export const updateUserStatusResponseSchema = Schema(
    "UpdateUserStatus",
    z.object({
        message: z.string(),
        isActive: z.boolean(),
    }),
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

export const registerUserInputSchema = Schema(
    "RegisterUserInput",
    z.object({
        name: z.string().trim().min(1).max(120).meta({
            description: "The member's full name",
        }),
        email: z.string().trim().toLowerCase().email().meta({
            description:
                "The member's address. Must be @stud.ntnu.no unless 'username' is given, since the username is otherwise derived from it",
        }),
        password: z.string().min(8).max(128).meta({
            description: "The password the member chose",
        }),
        studyProgramSlug: z.string().trim().min(1).meta({
            description:
                "Slug of the STUDY group to enrol the member in, e.g. 'dataingenir'",
        }),
        username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]{1,15}$/)
            .optional()
            .meta({
                description:
                    "The NTNU username to give the member, for callers registering students who have not been given their @stud.ntnu.no address yet. Should be the member's Feide username, so a later Feide login lands on this same account. Omit to derive it from the address.",
            }),
    }),
);

export const registerUserResponseSchema = Schema(
    "RegisterUser",
    z.object({
        id: z.string().meta({ description: "The new user's id" }),
        username: z.string().meta({
            description: "Derived from the e-mail's local part",
        }),
        email: z.string(),
        emailVerificationRequired: z.literal(true).meta({
            description:
                "Always true. A verification mail has been sent, and the account cannot sign in on tihlde.org until it is used.",
        }),
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
        isActive: z.boolean().meta({
            description:
                "False when the account is deactivated — the member cannot sign in.",
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
