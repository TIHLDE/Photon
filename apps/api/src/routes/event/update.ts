import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db, { type DbSchema, schema } from "~/db";
import { generateUniqueEventSlug } from "../../lib/event/slug";
import { HTTPException } from "hono/http-exception";
import { eq, type InferInsertModel } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { updateEventSchema } from "../../lib/event/schema";

const updateBodySchemaOpenAPI =
    await resolver(updateEventSchema).toOpenAPISchema();

export const updateRoute = new Hono().put(
    "/:id",
    describeRoute({
        tags: ["events"],
        summary: "Update event",
        requestBody: {
            content: {
                "application/json": { schema: updateBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Updated",
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    validator("json", updateEventSchema),
    async (c) => {
        const body = c.req.valid("json");
        const eventId = c.req.param("id");
        const userId = c.get("user").id;

        await db.transaction(async (tx) => {
            // Fetch existing event
            const existing = await tx
                .select()
                .from(schema.event)
                .where(eq(schema.event.id, eventId))
                .limit(1);

            if (existing.length === 0 || !existing[0]) {
                throw new HTTPException(404, { message: "Event not found" });
            }
            const event = existing[0];

            // Validate referenced entities if updated
            if (body.categorySlug && body.categorySlug !== event.categorySlug) {
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
            }
            if (
                body.organizerGroupSlug &&
                body.organizerGroupSlug !== event.organizerGroupSlug
            ) {
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
            }
            if (
                body.contactPersonUserId &&
                body.contactPersonUserId !== event.contactPersonId
            ) {
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

            // If title is updated, generate new slug
            let slug = event.slug;
            if (body.title && body.title !== event.title) {
                slug = await generateUniqueEventSlug(body.title, tx);
                if (slug.length > 256) {
                    throw new HTTPException(400, {
                        message:
                            "Generated slug is too long (> 256 chars). Please use a shorter title",
                    });
                }
            }

            const updatedEvent: Partial<InferInsertModel<DbSchema["event"]>> = {
                ...body,
                start: body.start ? new Date(body.start) : undefined,
                end: body.end ? new Date(body.end) : undefined,
                registrationStart: body.registrationStart
                    ? new Date(body.registrationStart)
                    : undefined,
                registrationEnd: body.registrationEnd
                    ? new Date(body.registrationEnd)
                    : undefined,
                cancellationDeadline: body.cancellationDeadline
                    ? new Date(body.cancellationDeadline)
                    : undefined,
                updateByUserId: userId,
            };

            await tx
                .update(schema.event)
                .set(updatedEvent)
                .where(eq(schema.event.id, eventId));
        });

        return c.json("Event has been updated!", 200);
    },
);
