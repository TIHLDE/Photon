import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const slugParamSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(12)
        .meta({ description: "Short share-link slug for the event" }),
});

const timeString = z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .meta({ description: '"HH:mm" time string' });

const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .meta({ description: 'ISO "YYYY-MM-DD" date string' });

export const createMotetidEventSchema = Schema(
    "CreateMotetidEvent",
    z.object({
        title: z.string().min(2).max(200).meta({ description: "Event title" }),
        dates: z
            .array(dateString)
            .min(1)
            .max(62)
            .meta({ description: "Candidate dates" }),
        startTime: timeString,
        endTime: timeString,
        deadline: z.iso.datetime().optional().meta({
            description:
                "Optional deadline; the board becomes read-only after this instant",
        }),
    }),
);

export const slotStatusSchema = z
    .enum(["AVAILABLE", "IF_NEEDED"])
    .meta({ description: "Availability status for a slot" });

export const saveAvailabilitySchema = Schema(
    "SaveMotetidAvailability",
    z.object({
        name: z
            .string()
            .min(1)
            .max(100)
            .meta({ description: "Display name for the participant" }),
        slots: z
            .array(
                z.object({
                    date: dateString,
                    time: timeString,
                    status: slotStatusSchema,
                }),
            )
            .max(5000)
            .meta({ description: "The participant's full slot selection" }),
    }),
);

export const googleConnectQuerySchema = z.object({
    returnTo: z
        .string()
        .optional()
        .meta({ description: "Relative path to return to after OAuth" }),
});

// ===== RESPONSE SCHEMAS =====

const participantSlotSchema = z.object({
    date: dateString,
    time: timeString,
    status: slotStatusSchema,
});

const motetidParticipantSchema = z.object({
    id: z.uuidv4().meta({ description: "Participant ID" }),
    name: z.string().meta({ description: "Display name" }),
    userId: z.string().nullable().meta({
        description: "Linked user id, null for anonymous participants",
    }),
    slots: z.array(participantSlotSchema),
});

export const motetidEventSchema = Schema(
    "MotetidEvent",
    z.object({
        id: z.uuidv4().meta({ description: "Event ID" }),
        slug: z.string().meta({ description: "Share-link slug" }),
        title: z.string(),
        dates: z
            .array(dateString)
            .meta({ description: "Candidate dates, sorted" }),
        startTime: timeString,
        endTime: timeString,
        slotDuration: z
            .number()
            .int()
            .meta({ description: "Slot length in minutes" }),
        deadline: z.iso.datetime().nullable(),
        createdAt: z.iso.datetime(),
        participants: z.array(motetidParticipantSchema),
        viewer: z.object({
            isAuthenticated: z.boolean(),
            isOwner: z.boolean(),
            participantId: z
                .uuidv4()
                .nullable()
                .meta({ description: "The viewer's participant row, if any" }),
            name: z
                .string()
                .nullable()
                .meta({ description: "Suggested display name for the viewer" }),
        }),
    }),
);

export const motetidEventListItemSchema = Schema(
    "MotetidEventListItem",
    z.object({
        id: z.uuidv4(),
        slug: z.string(),
        title: z.string(),
        dates: z.array(dateString),
        startTime: timeString,
        endTime: timeString,
        deadline: z.iso.datetime().nullable(),
        createdAt: z.iso.datetime(),
        isOwner: z
            .boolean()
            .meta({ description: "Whether the caller created the event" }),
        participantCount: z.number().int(),
    }),
);

export const motetidEventListSchema = Schema(
    "MotetidEventList",
    z
        .array(motetidEventListItemSchema)
        .describe("Events the caller created or participates in, newest first"),
);

export const createMotetidEventResponseSchema = Schema(
    "CreateMotetidEventResponse",
    z.object({
        id: z.uuidv4(),
        slug: z
            .string()
            .meta({ description: "Share-link slug for the new event" }),
    }),
);

export const saveAvailabilityResponseSchema = Schema(
    "SaveMotetidAvailabilityResponse",
    z.object({
        participantId: z.uuidv4(),
    }),
);

export const deleteMotetidEventResponseSchema = Schema(
    "DeleteMotetidEventResponse",
    z.object({
        message: z.string().meta({ description: "Success message" }),
    }),
);

export const googleConnectResponseSchema = Schema(
    "MotetidGoogleConnectResponse",
    z.object({
        url: z.string().meta({
            description: "Google OAuth consent URL to navigate the browser to",
        }),
    }),
);

export const syncCalendarResponseSchema = Schema(
    "MotetidSyncCalendarResponse",
    z.object({
        blocked: z
            .array(z.string())
            .meta({ description: 'Busy grid slots as "date|time" keys' }),
        events: z.array(
            z.object({
                title: z.string(),
                start: z.iso.datetime(),
                end: z.iso.datetime(),
            }),
        ),
    }),
);

export const syncCalendarErrorSchema = Schema(
    "MotetidSyncCalendarError",
    z.object({
        error: z.string(),
        requiresReconnect: z
            .boolean()
            .optional()
            .meta({ description: "The user must redo the Google OAuth flow" }),
    }),
);
