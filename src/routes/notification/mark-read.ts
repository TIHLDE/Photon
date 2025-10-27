import { and, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";

const markReadSchema = z.object({
	isRead: z
		.boolean()
		.meta({ description: "Whether notification should be marked as read" }),
});

const markReadResponseSchema = z.object({
	id: z.string().meta({ description: "Notification ID" }),
	isRead: z.boolean().meta({ description: "Updated read status" }),
	updatedAt: z.iso
		.datetime()
		.meta({ description: "Notification update time (ISO 8601)" }),
});

const markReadSchemaOpenApi = await resolver(
	markReadSchema,
).toOpenAPISchema();
const markReadResponseSchemaOpenApi = await resolver(
	markReadResponseSchema,
).toOpenAPISchema();

export const markReadNotificationRoute = route().patch(
	"/:id/read",
	describeRoute({
		tags: ["notifications"],
		summary: "Mark notification as read or unread",
		description:
			"Update the read status of a notification. User must be authenticated and own the notification.",
		requestBody: {
			content: {
				"application/json": { schema: markReadSchemaOpenApi.schema },
			},
		},
		responses: {
			200: {
				description: "Notification updated successfully",
				content: {
					"application/json": {
						schema: markReadResponseSchemaOpenApi.schema,
					},
				},
			},
			404: {
				description: "Notification not found or not owned by user",
			},
			401: {
				description: "Unauthorized - user not authenticated",
			},
		},
	}),
	requireAuth,
	validator("json", markReadSchema),
	async (c) => {
		const { db } = c.get("ctx");
		const notificationId = c.req.param("id");
		const userId = c.get("user").id;
		const { isRead } = c.req.valid("json");

		const [updated] = await db
			.update(schema.notification)
			.set({ isRead })
			.where(
				and(
					eq(schema.notification.id, notificationId),
					eq(schema.notification.userId, userId),
				),
			)
			.returning();

		if (!updated) {
			throw new HTTPException(404, {
				message: "Notification not found or not owned by user",
			});
		}

		return c.json({
			id: updated.id,
			isRead: updated.isRead,
			updatedAt: updated.updatedAt.toISOString(),
		});
	},
);
