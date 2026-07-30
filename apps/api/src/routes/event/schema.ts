import {
    eventVisibilityVariants,
    registrationStatusVariants,
} from "@photon/db/schema";
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
    location: z.string().max(256).meta({
        description: "Location of the event (physical or online)",
    }),
    locationLat: z.number().min(-90).max(90).nullable().optional().meta({
        description:
            "Latitude of the location, when picked from address search",
    }),
    locationLng: z.number().min(-180).max(180).nullable().optional().meta({
        description:
            "Longitude of the location, when picked from address search",
    }),
    imageUrl: z
        .url()
        .nullable()
        .meta({ description: "Main image to display for the event" }),
    imageAlt: z
        .string()
        .max(255)
        .nullable()
        .optional()
        .meta({ description: "Alt text for the event image" }),

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
    restrictedToInstituteSlug: z.string().nullable().optional().meta({
        description:
            "Slug of the NTNU institute this event is reserved for (e.g. 'idi' or 'iik'). Only members of a study group belonging to that institute may sign up. Null — the default — leaves the event open to every institute.",
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
        description: "Should users be able to react to this event with emojis?",
    }),

    // Visibility
    visibility: z.enum(eventVisibilityVariants).default("public").meta({
        description:
            "Who may see the event. 'public' is visible to everyone including logged-out visitors; 'members' hides it from unauthenticated callers.",
    }),
});

export const createEventSchema = Schema(
    "CreateEventSchema",
    eventMutationSchema.superRefine((val, ctx) => {
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
    }),
);

export const updateEventSchema = Schema(
    "UpdateEventSchema",
    eventMutationSchema.partial().superRefine((val, ctx) => {
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
    }),
);

export const updateFavoriteSchema = Schema(
    "UpdateFavoriteEvent",
    z.object({
        isFavorite: z.boolean().meta({ description: "Is favorite" }),
    }),
);

export const registerSchema = Schema(
    "RegsterForEvent",
    z.object({
        eventId: z.uuid(),
        userId: z.string(),
        status: z.literal("pending"),
        createdAt: z.string(),
    }),
);

export const createRegistrationBodySchema = Schema(
    "CreateEventRegistrationBody",
    z.object({
        allowPhoto: z.boolean().default(true).meta({
            description:
                "Photo consent for this event, overriding the account-level allowsPhotosByDefault",
        }),
    }),
);

export const createPaymentBodySchema = Schema(
    "CreatePaymentBody",
    z.object({
        returnUrl: z
            .url()
            .meta({ description: "URL to redirect user after payment" }),
        userFlow: z
            .enum(["WEB_REDIRECT", "NATIVE_REDIRECT"])
            .default("WEB_REDIRECT")
            .meta({ description: "User flow type for payment" }),
    }),
);

export const eventListFilterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter events by title",
    }),
    // Accepts both "?category=a,b" and "?category=a&category=b": Hono hands a
    // repeated param over as an array, while clients that serialise a list into
    // a single param send it comma-joined. preprocess (rather than a union)
    // keeps the documented type a plain string array.
    category: z
        .preprocess((value) => {
            if (value === undefined) return undefined;
            const slugs = (
                Array.isArray(value) ? value : String(value).split(",")
            )
                .map((slug) => String(slug).trim())
                .filter(Boolean);
            return slugs.length > 0 ? slugs : undefined;
        }, z.array(z.string()).optional())
        .meta({
            type: "array",
            items: { type: "string" },
            description:
                "Only return events in these category slugs. Omit to return every category.",
        }),
    // stringbool parses the "true"/"false" a query string actually carries;
    // the meta type keeps it a boolean in OpenAPI, where that encoding is implied.
    expired: z.stringbool().optional().meta({
        type: "boolean",
        description:
            "Filter on whether the event has already ended. True returns only past events, false only upcoming ones. Omit to return both.",
    }),
    openSignUp: z.stringbool().optional().meta({
        type: "boolean",
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
        description: z
            .string()
            .meta({ description: "Event description, stored as markdown" }),
        location: z
            .string()
            .nullable()
            .optional()
            .meta({ description: "Event location (nullable)" }),
        locationLat: z
            .number()
            .nullable()
            .optional()
            .meta({ description: "Latitude of the location (nullable)" }),
        locationLng: z
            .number()
            .nullable()
            .optional()
            .meta({ description: "Longitude of the location (nullable)" }),
        startTime: z.iso
            .datetime()
            .meta({ description: "Event start time (ISO 8601)" }),
        endTime: z.iso
            .datetime()
            .meta({ description: "Event end time (ISO 8601)" }),
        registrationStart: z.iso.datetime().nullable().meta({
            description:
                "When registration opens (ISO 8601). Null means it is open immediately.",
        }),
        registrationEnd: z.iso.datetime().nullable().meta({
            description:
                "When registration closes (ISO 8601). Null when the event has no sign-up.",
        }),
        cancellationDeadline: z.iso.datetime().nullable().meta({
            description:
                "Last moment a registration can be cancelled without a strike (ISO 8601, nullable)",
        }),
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
        requiresSigningUp: z.boolean().meta({
            description: "Do users need to sign up to attend the event?",
        }),
        allowWaitlist: z.boolean().meta({
            description: "May users join a waitlist when the event is full?",
        }),
        capacity: z.number().int().nullable().meta({
            description:
                "Maximum number of participants. Null means no capacity limit.",
        }),
        canCauseStrikes: z.boolean().meta({
            description:
                "Can this event give strikes for late cancellation or no-show?",
        }),
        image: z
            .url()
            .nullable()
            .meta({ description: "Event image URL (nullable)" }),
        imageAlt: z
            .string()
            .nullable()
            .meta({ description: "Alt text for the event image (nullable)" }),
        createdById: z.string().nullable().meta({
            description:
                "Creator user ID. The creator may update and delete their own event, so clients need it to decide whether to offer those actions.",
        }),
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
                price: z.number().meta({
                    description:
                        "Event price in minor units (øre). Note the create/update endpoints take `price` in whole kroner instead.",
                }),
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
        onlyAllowPrioritized: z.boolean().meta({
            description: "Only members covered by a priority pool may register",
        }),
        restrictedToInstitute: z
            .object({
                slug: z.string().meta({ description: "Institute slug" }),
                shortName: z
                    .string()
                    .meta({ description: "Short institute name, e.g. 'IDI'" }),
                name: z.string().meta({ description: "Full institute name" }),
            })
            .nullable()
            .meta({
                description:
                    "The institute this event is reserved for. Only members of a study group under this institute may register. Null means open to every institute.",
            }),
        visibility: z.enum(eventVisibilityVariants).meta({
            description: "Who may see the event ('public' or 'members'-only)",
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
        endTime: z.iso
            .date()
            .meta({ description: "Event end time (ISO 8601)" }),
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
        imageAlt: z
            .string()
            .nullable()
            .meta({ description: "Alt text for the event image (nullable)" }),
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
        visibility: z.enum(eventVisibilityVariants).meta({
            description: "Who may see the event ('public' or 'members'-only)",
        }),
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

export const updateEventResponseSchema = Schema(
    "UpdateEventResponse",
    z.object({
        eventId: z.uuid(),
        slug: z.string().meta({
            description:
                "The event slug after the update. Changing the title regenerates it, so clients must use this when linking to the event.",
        }),
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
        allowPhoto: z.boolean().meta({
            description: "Photo consent for this event",
        }),
    }),
);

const paymentStatusSchema = z.enum(["pending", "paid", "refunded", "failed"]);

/**
 * Slim payment view attached to an admin's registration listing.
 */
export const registrationPaymentSchema = Schema(
    "EventRegistrationPayment",
    z.object({
        id: z.uuid(),
        status: paymentStatusSchema,
        amountMinor: z.number(),
        currency: z.string(),
        expiresAt: z.iso.datetime().nullable(),
        receivedPaymentAt: z.iso.datetime().nullable(),
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
        allowPhoto: z.boolean().optional().meta({
            description:
                "Photo consent for this event. Only included when the caller has event admin permissions.",
        }),
        status: z.string().optional().meta({
            description:
                "Registration status (registered/attended/no_show). Only included for event admins.",
        }),
        attendedAt: z.string().nullable().optional().meta({
            description:
                "When the user was checked in, if at all. Only included for event admins.",
        }),
        email: z.string().optional().meta({
            description: "User email. Only included for event admins.",
        }),
        registeredAt: z.string().optional().meta({
            description:
                "When the user registered. Only included for event admins.",
        }),
        waitlistPosition: z.number().nullable().optional().meta({
            description:
                "Position on the waitlist, if waitlisted. Only included for event admins.",
        }),
        payment: registrationPaymentSchema.nullable().optional().meta({
            description:
                "The user's payment for this event, if any. Only included for event admins.",
        }),
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

export const eventPaymentAdminSchema = Schema(
    "EventPaymentAdmin",
    z.object({
        id: z.uuid(),
        userId: z.string(),
        user: z.object({
            id: z.string(),
            name: z.string(),
            image: z.string().nullable(),
            email: z.string(),
        }),
        amountMinor: z.number().meta({
            description: "Amount in minor units (øre)",
        }),
        currency: z.string(),
        provider: z.string().nullable(),
        providerPaymentId: z.string().nullable().meta({
            description:
                "Provider reference. Null means the obligation was never started with the provider.",
        }),
        status: paymentStatusSchema,
        receivedPaymentAt: z.iso.datetime().nullable(),
        expiresAt: z.iso.datetime().nullable(),
        createdAt: z.iso.datetime(),
    }),
);

export const eventPaymentListResponseSchema = Schema(
    "EventPaymentList",
    PagniationResponseSchema.extend({
        payments: z
            .array(eventPaymentAdminSchema)
            .describe("List of payments for the event (paginated)"),
        summary: z
            .object({
                paidCount: z.number(),
                pendingCount: z.number(),
                refundedCount: z.number(),
                failedCount: z.number(),
                totalPaidMinor: z.number().meta({
                    description:
                        "Sum of all completed (paid) payments, in minor units",
                }),
            })
            .describe("Totals across every payment for the event"),
    }),
);

export const refundEventPaymentResponseSchema = Schema(
    "RefundEventPayment",
    z.object({
        id: z.uuid(),
        status: paymentStatusSchema,
        refundedAmountMinor: z.number().meta({
            description: "The amount that was refunded, in minor units",
        }),
        currency: z.string(),
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
