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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_KEY = /^(MON|TUE|WED|THU|FRI|SAT|SUN)$/;

export const dateModeSchema = z.enum(["DATES", "WEEKDAYS"]).meta({
    description:
        'Whether the board\'s columns are calendar dates ("DATES", a one-off activity) or recurring weekdays ("WEEKDAYS", a fixed weekly slot)',
});

/**
 * A board column key: an ISO date, or a weekday key on a WEEKDAYS board.
 * Which of the two is valid depends on the event's `dateMode`, so the union
 * is narrowed per-request rather than in the shape itself.
 */
const dateKeyString = z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|MON|TUE|WED|THU|FRI|SAT|SUN)$/)
    .meta({
        description:
            'Board column key: ISO "YYYY-MM-DD" date, or "MON".."SUN" on a weekday board',
    });

export const createMotetidEventSchema = Schema(
    "CreateMotetidEvent",
    z
        .object({
            title: z
                .string()
                .min(2)
                .max(200)
                .meta({ description: "Event title" }),
            // Optional rather than `.default()`: the emitted OpenAPI schema
            // would otherwise mark it required and break existing clients.
            dateMode: dateModeSchema.optional(),
            dates: z.array(dateKeyString).min(1).max(62).meta({
                description:
                    "Candidate columns: ISO dates, or weekday keys when dateMode is WEEKDAYS",
            }),
            startTime: timeString,
            endTime: timeString,
            deadline: z.iso.datetime().optional().meta({
                description:
                    "Optional deadline; the board becomes read-only after this instant",
            }),
        })
        .check((ctx) => {
            const { dates } = ctx.value;
            const isWeekdays = ctx.value.dateMode === "WEEKDAYS";
            const matchesMode = (value: string) =>
                isWeekdays ? WEEKDAY_KEY.test(value) : ISO_DATE.test(value);

            if (!dates.every(matchesMode)) {
                ctx.issues.push({
                    code: "custom",
                    input: dates,
                    path: ["dates"],
                    message: isWeekdays
                        ? 'dates must be weekday keys ("MON".."SUN") when dateMode is WEEKDAYS'
                        : 'dates must be ISO "YYYY-MM-DD" strings when dateMode is DATES',
                });
            }

            if (new Set(dates).size !== dates.length) {
                ctx.issues.push({
                    code: "custom",
                    input: dates,
                    path: ["dates"],
                    message: "dates must not contain duplicates",
                });
            }
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
                    date: dateKeyString,
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
    date: dateKeyString,
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
        dateMode: dateModeSchema,
        dates: z.array(dateKeyString).meta({
            description:
                "Candidate columns, sorted chronologically (DATES) or Monday-first (WEEKDAYS)",
        }),
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
        dateMode: dateModeSchema,
        dates: z.array(dateKeyString),
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
