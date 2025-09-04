import { z } from "zod";

// Enums
export const EventStatusSchema = z.enum([
    "DRAFT",
    "PUBLISHED",
    "CANCELLED",
    "COMPLETED",
]);
export const RegistrationStatusSchema = z.enum([
    "REGISTERED",
    "WAITLISTED",
    "CANCELLED",
]);

// Base event schema
export const EventSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().nullable(),
    location: z.string().nullable(),
    maxParticipants: z.number().int().positive().nullable(),
    registrationStart: z.string().datetime().nullable(),
    registrationEnd: z.string().datetime().nullable(),
    status: EventStatusSchema,
    organizerId: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

// Create event schema
export const CreateEventSchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    location: z.string().max(255).optional(),
    maxParticipants: z.number().int().positive().optional(),
    registrationStart: z.string().datetime().optional(),
    registrationEnd: z.string().datetime().optional(),
    status: EventStatusSchema.optional().default("DRAFT"),
});

// Update event schema
export const UpdateEventSchema = CreateEventSchema.partial();

// Event with organizer
export const EventWithOrganizerSchema = EventSchema.extend({
    organizer: z.object({
        id: z.string(),
        name: z.string(),
        username: z.string(),
        avatar: z.string().nullable(),
    }),
});

// Event with stats
export const EventWithStatsSchema = EventWithOrganizerSchema.extend({
    _count: z.object({
        registrations: z.number(),
        waitlistedRegistrations: z.number(),
    }),
    userRegistration: z
        .object({
            id: z.string(),
            status: RegistrationStatusSchema,
            createdAt: z.string().datetime(),
        })
        .nullable(),
});

// Event registration schema
export const EventRegistrationSchema = z.object({
    id: z.string(),
    status: RegistrationStatusSchema,
    notes: z.string().nullable(),
    eventId: z.string(),
    userId: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

// Event registration with user
export const EventRegistrationWithUserSchema = EventRegistrationSchema.extend({
    user: z.object({
        id: z.string(),
        name: z.string(),
        username: z.string(),
        avatar: z.string().nullable(),
    }),
});

// Query schemas
export const EventsQuerySchema = z.object({
    page: z
        .string()
        .transform(Number)
        .pipe(z.number().int().positive())
        .optional(),
    limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().positive().max(100))
        .optional(),
    status: EventStatusSchema.optional(),
    search: z.string().min(1).optional(),
    organizerId: z.string().optional(),
    upcoming: z
        .string()
        .transform((v) => v === "true")
        .optional(),
});

// Registration request schema
export const RegisterForEventSchema = z.object({
    notes: z.string().max(500).optional(),
});

// Move from waitlist schema
export const MoveFromWaitlistSchema = z.object({
    userId: z.string(),
});

// Path params schemas
export const EventIdParamSchema = z.object({
    id: z.string(),
});

// Response schemas
export const EventListResponseSchema = z.object({
    data: z.array(EventWithStatsSchema),
    pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
    }),
});

export const ErrorResponseSchema = z.object({
    message: z.string(),
    code: z.string().optional(),
});

export const SuccessResponseSchema = z.object({
    message: z.string(),
});

// Types
export type Event = z.infer<typeof EventSchema>;
export type CreateEvent = z.infer<typeof CreateEventSchema>;
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;
export type EventWithOrganizer = z.infer<typeof EventWithOrganizerSchema>;
export type EventWithStats = z.infer<typeof EventWithStatsSchema>;
export type EventRegistration = z.infer<typeof EventRegistrationSchema>;
export type EventRegistrationWithUser = z.infer<
    typeof EventRegistrationWithUserSchema
>;
export type EventsQuery = z.infer<typeof EventsQuerySchema>;
export type RegisterForEvent = z.infer<typeof RegisterForEventSchema>;
export type MoveFromWaitlist = z.infer<typeof MoveFromWaitlistSchema>;
export type EventIdParam = z.infer<typeof EventIdParamSchema>;
