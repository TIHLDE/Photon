import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { getFeedbackItem } from "~/lib/feedback/serialize";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { feedbackIdParamSchema, feedbackItemSchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["feedback"],
        summary: "Get feedback",
        operationId: "getFeedback",
        description: "A single idea or bug report. Requires authentication.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: feedbackItemSchema,
            description: "OK",
        })
        .notFound({ description: "Feedback not found" })
        .build(),
    requireAuth,
    validator("param", feedbackIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");

        const item = await getFeedbackItem(db, id, c.get("user").id);

        if (!item) {
            throw new HTTPException(404, { message: "Feedback not found" });
        }

        return c.json(item);
    },
);
