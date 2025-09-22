import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db, { type DbSchema, schema } from "~/db";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { HTTPException } from "hono/http-exception";
import { eq, type InferInsertModel } from "drizzle-orm";

const createBodySchema = z
    .object({
        // Core event info
        title: z
            .string()
            .max(256)
            .meta({ description: "Short title of the event" }),
        description: z
            .string()
            .meta({ description: "Description of the event" }),
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
            .optional()
            .meta({ description: "Main image to display for the event" }),

        // Timing
        start: z.iso.datetime().meta({ description: "When the event starts" }),
        end: z.iso.datetime().meta({ description: "When the event ends" }),
        registrationStart: z.iso.datetime().optional().meta({
            description:
                "Timestamp for when registrations open. If null, open immediately.",
        }),
        registrationEnd: z.iso.datetime().meta({
            description:
                "When the registration for the event ends. After this time, users cannot sign up.",
        }),
        cancellationDeadline: z.iso.datetime().optional().meta({
            description:
                "Deadline timestamp for when users cannot cancel anymore. After this, no-shows may receive strikes.",
        }),

        // Participation & limits
        capacity: z.number().int().min(1).optional().meta({
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
        priorityPools: z.array(z.string()).optional().meta({
            description:
                "List of group slugs that are prioritized for signing up. The more of these groups a user is in, the higher priority they get.",
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
            description:
                "Should the system enforce strike rules for this event?",
        }),

        // Payment
        isPaidEvent: z.boolean().meta({ description: "Is this a paid event?" }),
        price: z.number().min(0).optional().meta({
            description:
                "Price in NOK for attending the event. Can only be set if isPaidEvent is true.",
        }),
        paymentGracePeriodMinutes: z.number().optional().meta({
            description:
                "The time (in minutes) between sign up and payment must be made. After this period, unpaid registrations are cancelled. Can only be set if isPaidEvent is true.",
        }),

        // Misc
        contactPersonUserId: z.string().optional().meta({
            description: "User ID of the primary contact person for the event",
        }),
        reactionsAllowed: z.boolean().meta({
            description:
                "Should users be able to react to this event with emojis?",
        }),
    })
    .superRefine((val, ctx) => {
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
            if (val.price !== undefined && val.price <= 0) {
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

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    capacity: z.number(),
    allowWaitlist: z.boolean(),
    createdByUserId: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

const createBodySchemaOpenAPI =
    await resolver(createBodySchema).toOpenAPISchema();

export const createRoute = new Hono().post(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Create event",
        requestBody: {
            content: {
                "application/json": { schema: createBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": { schema: resolver(eventSchema) },
                },
            },
        },
    }),
    // requireAuth,
    // requirePermissions("events:create"),
    validator("json", createBodySchema),
    async (c) => {
        const body = c.req.valid("json");
        // const userId = c.get("user").id;
        const userId = "3aypzcMPXy4p7fBxkLxhLZvY4w1JfzN9"; // TODO TEMP

        await db.transaction(async (tx) => {
            const slug = await generateUniqueEventSlug(body.title, tx);
            if (slug.length > 256) {
                throw new HTTPException(400, {
                    message:
                        "Generated slug is too long (> 256 chars). Please use a shorter title",
                });
            }

            // Check that category exists
            const category = await tx
                .select()
                .from(schema.eventCategory)
                .where(eq(schema.eventCategory.slug, body.categorySlug))
                .limit(1);
            if (category.length === 0) {
                throw new HTTPException(400, {
                    message: `Category with slug "${body.categorySlug}" does not exist`,
                });
            }

            // Check that organizer group exists
            const group = await tx
                .select()
                .from(schema.group)
                .where(eq(schema.group.slug, body.organizerGroupSlug))
                .limit(1);
            if (group.length === 0) {
                throw new HTTPException(400, {
                    message: `Group with slug "${body.organizerGroupSlug}" does not exist`,
                });
            }

            // Check that contact person exists
            if (body.contactPersonUserId) {
                const contactPerson = await tx
                    .select()
                    .from(schema.user)
                    .where(eq(schema.user.id, body.contactPersonUserId))
                    .limit(1);
                if (contactPerson.length === 0) {
                    throw new HTTPException(400, {
                        message: `User with ID "${body.contactPersonUserId}" does not exist`,
                    });
                }
            }

            const newEvent: InferInsertModel<DbSchema["event"]> = {
                title: body.title,
                description: body.description,
                location: body.location,
                start: new Date(body.start),
                end: new Date(body.end),
                capacity: body.capacity,
                allowWaitlist: body.requiresSigningUp,
                slug,
                price: body.price,
                isPaidEvent: body.isPaidEvent,
                requiresSigningUp: body.requiresSigningUp,
                registrationStart: body.registrationStart
                    ? new Date(body.registrationStart)
                    : undefined,
                registrationEnd: body.registrationEnd
                    ? new Date(body.registrationEnd)
                    : undefined,
                cancellationDeadline: body.cancellationDeadline
                    ? new Date(body.cancellationDeadline)
                    : undefined,
                isRegistrationClosed: body.isRegistrationClosed,
                contactPersonId: body.contactPersonUserId,
                reactionsAllowed: body.reactionsAllowed,
                categorySlug: body.categorySlug,
                paymentGracePeriodMinutes: body.paymentGracePeriodMinutes,
                imageUrl: body.imageUrl,
                createdByUserId: userId,
                updateByUserId: userId,
            };

            await db.insert(schema.event).values(newEvent);
        });

        return c.json({ message: "Event created" }, 201);
    },
);
