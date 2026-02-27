import { registrationStatusVariants } from "@photon/db/schema";
import { schema } from "@photon/db";
import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
} from "~/middleware/pagination";

// ===== INPUT SCHEMAS (from lib/event/schema.ts) =====

const eventMutationSchema = z.object({
    // Core event info
    title: z
        .string()
        .max(256)
        .meta({ description: "Short title of the event" }),
    description: z.string().meta({ description: "Description of the event" }),
    categorySlug: z
        .string()
        .meta({ description: "Category slug for the event" }),
    organizerGroupSlug: z
        .string()
        .meta({ description: "Slug of the group organizing the event" }),
    location: z.string().meta({
        description: "Location of the event (physical or online)",
    }),
    imageUrl: z
        .url()
        .nullable()
        .meta({ description: "Main image to display for the event" }),

    // Timing
    start: z.iso.datetime().meta({ description: "When the event starts" }),
    end: z.iso.datetime().meta({ description: "When the event ends" }),
    registrationStart: z.iso.datetime().nullable().meta({
        description:
            "Timestamp for when registrations open. If null, open immediately.",
    }),
    registrationEnd: z.iso.datetime().meta({
        description:
            "When the registration for the event ends. After this time, users cannot sign up.",
    }),
    cancellationDeadline: z.iso.datetime().nullable().meta({
        description:
            "Deadline timestamp for when users cannot cancel anymore. After this, no-shows may receive strikes.",
    }),

    // Participation & limits
    capacity: z.number().int().min(1).nullable().meta({
        description:
            "Maximum number of participants allowed. If null, no capacity limit.",
    }),
    isRegistrationClosed: z.boolean().meta({
        description:
            "Is the event closed for new registrations? This overrides registrationStart/End",
    }),
    requiresSigningUp: z.boolean().meta({
        description: "Do users need to sign up to attend the event?",
    }),
    allowWaitlist: z.boolean().meta({
        description:
            "Should users be allowed to join a waitlist if the event is full?",
    }),

    // Priority & pools
    priorityPools: z
        .array(
            z.object({
                groups: z
                    .array(z.string())
                    .meta({ description: "Group slugs in this pool" }),
            }),
        )
        .nullable()
        .meta({
            description:
                "List of priority pools, with priority in descending order. Each pool contains a list of group slugs. Users in groups in the first pool have highest priority, then second pool, etc. Users not in any pool have lowest priority.",
        }),
    onlyAllowPrioritized: z.boolean().meta({
        description:
            "Only allow users in at least one priority pool to sign up. Can only be true if at least one group is in priorityPools.",
    }),

    // Strikes & enforcement
    canCauseStrikes: z.boolean().meta({
        description: "Can this event give strike penalties to users?",
    }),
    enforcesPreviousStrikes: z.boolean().meta({
        description: "Should the system enforce strike rules for this event?",
    }),

    // Payment
    isPaidEvent: z.boolean().meta({ description: "Is this a paid event?" }),
    price: z.number().min(0).nullable().meta({
        description:
            "Price in NOK for attending the event. Can only be set if isPaidEvent is true.",
    }),
    paymentGracePeriodMinutes: z.number().nullable().meta({
        description:
            "The time (in minutes) between sign up and payment must be made. After this period, unpaid registrations are cancelled. Can only be set if isPaidEvent is true.",
    }),

    // Misc
    contactPersonUserId: z.string().nullable().meta({
        description: "User ID of the primary contact person for the event",
    }),
    reactionsAllowed: z.boolean().meta({
        description:
            "Should users be able to react to this event with emojis?",
    }),
});

export const createEventSchema = eventMutationSchema.superRefine((val, ctx) => {
    if (
        val.onlyAllowPrioritized &&
        (!val.priorityPools || val.priorityPools.length === 0)
    ) {
        ctx.addIssue({
            code: "custom",
            message:
                "onlyAllowPrioritized cannot be true if priorityPools is empty",
            path: ["onlyAllowPrioritized"],
        });
    }

    if (val.isPaidEvent) {
        if (val.price === undefined) {
            ctx.addIssue({
                code: "custom",
                message: "price must be set if isPaidEvent is true",
                path: ["price"],
            });
        }
        if (!!val.price && val.price <= 0) {
            ctx.addIssue({
                code: "too_small",
                message: "price must be greater than 0",
                minimum: 1,
                origin: "number",
                path: ["price"],
            });
        }
        if (val.paymentGracePeriodMinutes === undefined) {
            ctx.addIssue({
                code: "custom",
                message:
                    "paymentGracePeriodMinutes must be set if isPaidEvent is true",
                path: ["paymentGracePeriod"],
            });
        }
    }

    if (new Date(val.end) <= new Date(val.start)) {
        ctx.addIssue({
            code: "custom",
            message: "end must be after start",
            path: ["end", "start"],
        });
    }

    if (!val.requiresSigningUp) {
        if (val.registrationStart) {
            ctx.addIssue({
                code: "custom",
                message:
                    "registrationStart cannot be set if requiresSigningUp is false",
                path: ["registrationStart"],
            });
        }
        if (val.registrationEnd) {
            ctx.addIssue({
                code: "custom",
                message:
                    "endRegistrationAt cannot be set if requiresSigningUp is false",
                path: ["endRegistrationAt"],
            });
        }
        if (val.cancellationDeadline) {
            ctx.addIssue({
                code: "custom",
                message:
                    "cancellationDeadline cannot be set if requiresSigningUp is false",
                path: ["cancellationDeadline"],
            });
        }
        if (val.allowWaitlist) {
            ctx.addIssue({
                code: "custom",
                message:
                    "allowWaitlist cannot be true if requiresSigningUp is false",
                path: ["allowWaitlist"],
            });
        }
    }

    if (
        val.cancellationDeadline &&
        new Date(val.cancellationDeadline) >= new Date(val.start)
    ) {
        ctx.addIssue({
            code: "custom",
            message: "cancellationDeadline must be before event start time",
            path: ["cancellationDeadline"],
        });
    }

    if (!val.requiresSigningUp && val.capacity !== undefined) {
        ctx.addIssue({
            code: "custom",
            message: "capacity cannot be set if requiresSigningUp is false",
            path: ["capacity"],
        });
    }

    if (val.paymentGracePeriodMinutes) {
        if (
            val.paymentGracePeriodMinutes < 5 ||
            val.paymentGracePeriodMinutes > 60 * 6
        ) {
            ctx.addIssue({
                code: "custom",
                message:
                    "paymentGracePeriod must be between PT5M and PT6H (5 minutes to 6 hours)",
                path: ["paymentGracePeriod"],
            });
        }
    }
});

export const updateEventSchema = eventMutationSchema
    .partial()
    .superRefine((val, ctx) => {
        if (
            val.onlyAllowPrioritized !== undefined &&
            val.onlyAllowPrioritized
        ) {
            if (!val.priorityPools || val.priorityPools.length === 0) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "onlyAllowPrioritized cannot be true if priorityPools is empty",
                    path: ["onlyAllowPrioritized"],
                });
            }
        }
        if (val.isPaidEvent !== undefined && val.isPaidEvent) {
            if (val.price === undefined) {
                ctx.addIssue({
                    code: "custom",
                    message: "price must be set if isPaidEvent is true",
                    path: ["price"],
                });
            }
            if (!!val.price && val.price <= 0) {
                ctx.addIssue({
                    code: "too_small",
                    message: "price must be greater than 0",
                    minimum: 1,
                    origin: "number",
                    path: ["price"],
                });
            }
            if (val.paymentGracePeriodMinutes === undefined) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "paymentGracePeriodMinutes must be set if isPaidEvent is true",
                    path: ["paymentGracePeriod"],
                });
            }
        }
        if (val.start && val.end && new Date(val.end) <= new Date(val.start)) {
            ctx.addIssue({
                code: "custom",
                message: "end must be after start",
                path: ["end", "start"],
            });
        }
        if (val.requiresSigningUp === false) {
            if (val.registrationStart) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "registrationStart cannot be set if requiresSigningUp is false",
                    path: ["registrationStart"],
                });
            }
            if (val.registrationEnd) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "endRegistrationAt cannot be set if requiresSigningUp is false",
                    path: ["endRegistrationAt"],
                });
            }
            if (val.cancellationDeadline) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "cancellationDeadline cannot be set if requiresSigningUp is false",
                    path: ["cancellationDeadline"],
                });
            }
            if (val.allowWaitlist) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "allowWaitlist cannot be true if requiresSigningUp is false",
                    path: ["allowWaitlist"],
                });
            }
            if (val.capacity !== undefined) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "capacity cannot be set if requiresSigningUp is false",
                    path: ["capacity"],
                });
            }
        }
        if (
            val.cancellationDeadline &&
            val.start &&
            new Date(val.cancellationDeadline) >= new Date(val.start)
        ) {
            ctx.addIssue({
                code: "custom",
                message: "cancellationDeadline must be before event start time",
                path: ["cancellationDeadline"],
            });
        }
        if (val.paymentGracePeriodMinutes) {
            if (
                val.paymentGracePeriodMinutes < 5 ||
                val.paymentGracePeriodMinutes > 60 * 6
            ) {
                ctx.addIssue({
                    code: "custom",
                    message:
                        "paymentGracePeriodMinutes must be between 5 minutes and 6 hours",
                    path: ["paymentGracePeriodMinutes"],
                });
            }
        }
    });

export const updateFavoriteSchema = z.object({
    isFavorite: z.boolean().meta({ description: "Is favorite" }),
});

export const registerSchema = z.object({
    eventId: z.uuid(),
    userId: z.string(),
    status: z.literal("pending"),
    createdAt: z.string(),
});

export const createPaymentBodySchema = z.object({
    returnUrl: z
        .url()
        .meta({ description: "URL to redirect user after payment" }),
    userFlow: z
        .enum(["WEB_REDIRECT", "NATIVE_REDIRECT"])
        .default("WEB_REDIRECT")
        .meta({ description: "User flow type for payment" }),
});

export const eventListFilterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter events by title",
    }),
    expired: z.coerce.boolean().optional().meta({
        description: "Whether to include expired events or not",
    }),
    openSignUp: z.coerce.boolean().optional().meta({
        description: "Whether to include only events with open sign-ups",
    }),
});

// ===== RESPONSE SCHEMAS =====

export const eventDetailSchema = Schema(
    "Event",
    z.object({
        id: z.uuid({ version: "v4" }).meta({ description: "Event ID" }),
        slug: z.string().meta({ description: "Event slug" }),
        title: z.string().meta({ description: "Event title" }),
        location: z
            .string()
            .nullable()
            .optional()
            .meta({ description: "Event location (nullable)" }),
        startTime: z.iso
            .datetime()
            .meta({ description: "Event start time (ISO 8601)" }),
        endTime: z.iso
            .datetime()
            .meta({ description: "Event end time (ISO 8601)" }),
        organizer: z
            .object({
                name: z.string().meta({ description: "Organizer name" }),
                slug: z.string().meta({ description: "Organizer slug" }),
                type: z.string().meta({ description: "Organizer type" }),
                image: z
                    .url()
                    .nullable()
                    .meta({ description: "Organizer image URL" }),
            })
            .nullable()
            .meta({ description: "Event organizer (nullable)" }),
        closed: z.boolean().meta({ description: "Is registration closed" }),
        image: z
            .url()
            .nullable()
            .meta({ description: "Event image URL (nullable)" }),
        createdAt: z.iso
            .datetime()
            .meta({ description: "Event creation time (ISO 8601)" }),
        updatedAt: z.iso
            .datetime()
            .meta({ description: "Event update time (ISO 8601)" }),
        category: z
            .object({
                slug: z.string().meta({ description: "Category slug" }),
                label: z.string().meta({ description: "Category label" }),
            })
            .meta({ description: "Event category" }),
        reactions: z.array(
            z.object({
                user: z.object({
                    id: z.string().meta({ description: "User ID" }),
                    name: z.string().meta({ description: "User name" }),
                }),
                emoji: z.string().meta({ description: "Reaction emoji" }),
            }),
        ),
        isPaidEvent: z.boolean().meta({ description: "Is this a paid event" }),
        payInfo: z
            .object({
                price: z
                    .number()
                    .meta({ description: "Event price in whole KR" }),
                paymentGracePeriodMinutes: z
                    .number()
                    .meta({ description: "Payment grace period in minutes" }),
            })
            .nullable()
            .meta({ description: "Payment info" }),
        priorityPools: z
            .array(
                z.object({
                    groups: z.array(
                        z.object({
                            name: z
                                .string()
                                .meta({ description: "Group name" }),
                            slug: z
                                .string()
                                .meta({ description: "Group slug" }),
                            imageUrl: z.string().nullable().meta({
                                description: "Group image URL (nullable)",
                            }),
                        }),
                    ),
                }),
            )
            .meta({ description: "Priority registration pools" }),
        enforcesPreviousStrikes: z.boolean().meta({
            description:
                "Does the event enforce previous strikes for registration",
        }),
        registration: z
            .object({
                createdAt: z.iso
                    .datetime()
                    .meta({ description: "When the user signed up" }),
                updatedAt: z.iso.datetime().meta({
                    description:
                        "When the registration was last updated by the system (moving waitlist position etc.)",
                }),
                status: z.enum(registrationStatusVariants),
                waitlistPosition: z.number().nullable().meta({
                    description:
                        "The user's position in the waitlist. Is null if not on the waitlist",
                }),
                attendedAt: z.iso.datetime().nullable().meta({
                    description:
                        "When the user was registered as an attendee by TIHLDE for this event. Is null if not attended.",
                }),
            })
            .nullable()
            .meta({
                description:
                    "The current user's registration information. This is null if not registered or if not logged in.",
            }),
    }),
);

export const eventListItemSchema = Schema(
    "EventListItem",
    z.object({
        id: z.uuid({ version: "v4" }).meta({ description: "Event ID" }),
        slug: z.string().meta({ description: "Event slug" }),
        title: z.string().meta({ description: "Event title" }),
        location: z
            .string()
            .nullable()
            .optional()
            .meta({ description: "Event location (nullable)" }),
        startTime: z.iso
            .date()
            .meta({ description: "Event start time (ISO 8601)" }),
        endTime: z.iso.date().meta({ description: "Event end time (ISO 8601)" }),
        organizer: z
            .object({
                name: z.string().meta({ description: "Organizer name" }),
                slug: z.string().meta({ description: "Organizer slug" }),
                type: z.string().meta({ description: "Organizer type" }),
            })
            .nullable()
            .meta({ description: "Event organizer (nullable)" }),
        closed: z.boolean().meta({ description: "Is registration closed" }),
        image: z
            .url()
            .nullable()
            .meta({ description: "Event image URL (nullable)" }),
        createdAt: z.iso
            .date()
            .meta({ description: "Event creation time (ISO 8601)" }),
        updatedAt: z.iso
            .date()
            .meta({ description: "Event update time (ISO 8601)" }),
        category: z
            .object({
                slug: z.string().meta({ description: "Category slug" }),
                label: z.string().meta({ description: "Category label" }),
            })
            .meta({ description: "Event category" }),
    }),
);

export const eventListResponseSchema = Schema(
    "EventList",
    PagniationResponseSchema.extend({
        items: z.array(eventListItemSchema).describe("List of events"),
    }),
);

export const createEventResponseSchema = Schema(
    "CreateEventResponse",
    z.object({
        eventId: z.uuid(),
    }),
);

export const deleteEventResponseSchema = Schema(
    "DeleteEventResponse",
    z.object({
        message: z.string(),
    }),
);

export const favoriteEventsSchema = Schema(
    "FavoriteEvents",
    z.array(
        z.object({
            eventId: z.string().meta({ description: "Event ID" }),
            title: z.string().meta({ description: "Event title" }),
            slug: z.string().meta({ description: "Event slug" }),
            createdAt: z.iso.datetime().meta({
                description: "When you added this event to your favorites",
            }),
        }),
    ),
);

export const updateFavoriteResponseSchema = Schema(
    "UpdateFavoriteResponse",
    z.object({
        success: z.boolean(),
    }),
);

export const eventRegistrationResponseSchema = Schema(
    "EventRegistration",
    z.object({
        eventId: z.uuid(),
        userId: z.string(),
        status: z.literal("pending"),
        createdAt: z.string(),
    }),
);

export const registeredUserSchema = Schema(
    "EventRegisteredUser",
    z.object({
        id: z.string().meta({ description: "User id" }),
        name: z.string().meta({ description: "User name" }),
        image: z
            .string()
            .nullable()
            .meta({ description: "User image url (if any)" }),
    }),
);

export const eventRegistrationListResponseSchema = Schema(
    "EventRegistrationList",
    PagniationResponseSchema.extend({
        registeredUsers: z
            .array(registeredUserSchema)
            .describe("List of registered users (paginated)"),
    }),
);

export const createPaymentResponseSchema = Schema(
    "CreatePaymentResponse",
    z.object({
        eventId: z.uuid(),
        userId: z.string(),
        checkoutUrl: z.url(),
        amount: z.number(),
        currency: z.string(),
    }),
);
