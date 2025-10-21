import z from "zod";

// Shared schema for creating and updating events, with all required fields
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
        description: "Should users be able to react to this event with emojis?",
    }),
});

// Schema for creating a new event, that checks all invariants
export const createEventSchema = eventMutationSchema.superRefine((val, ctx) => {
    // Require priority pools for onlyAllowPrioritized
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

    // Require price and paymentGracePeriod for isPaidEvent
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

    // Require end after start
    if (new Date(val.end) <= new Date(val.start)) {
        ctx.addIssue({
            code: "custom",
            message: "end must be after start",
            path: ["end", "start"],
        });
    }

    // Cannot define registration/canellation if no signup needed
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

    // Cancellation deadline must be before event start
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

    // Capacity cannot be set if no signup needed
    if (!val.requiresSigningUp && val.capacity !== undefined) {
        ctx.addIssue({
            code: "custom",
            message: "capacity cannot be set if requiresSigningUp is false",
            path: ["capacity"],
        });
    }

    // Payment grace period must be between 5 minutes and 6 hours
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
        // Keep all invariants from createBodySchema, but only check if relevant fields are present
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
