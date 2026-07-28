import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { publishAsset } from "./asset-url";
import { toddelIssueSchema, updateToddelSchema } from "./schema";

export const updateRoute = route().patch(
    "/:edition",
    describeRoute({
        tags: ["toddel"],
        summary: "Update a TÖDDEL issue",
        operationId: "updateToddel",
        description:
            "Change the title, date or files of a published issue. Pass a new asset key to replace a file; leaving it out keeps the current one. Requires 'toddel:update' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: toddelIssueSchema,
            description: "Issue updated",
        })
        .badRequest({ description: "Unknown asset key" })
        .unauthorized()
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Issue not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["toddel:update", "toddel:manage"] }),
    validator("json", updateToddelSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, bucket } = c.get("ctx");
        const edition = Number(c.req.param("edition"));

        if (!Number.isInteger(edition)) {
            throw HTTPAppException.BadRequest("Edition must be a whole number");
        }

        const existing = await db.query.toddel.findFirst({
            where: eq(schema.toddel.edition, edition),
        });

        if (!existing) {
            throw HTTPAppException.NotFound("TÖDDEL issue");
        }

        // `imageKey: null` clears the cover; omitting it leaves it alone.
        const imageUrl =
            body.imageKey === undefined
                ? undefined
                : body.imageKey === null
                  ? null
                  : await publishAsset(bucket, body.imageKey);

        const [issue] = await db
            .update(schema.toddel)
            .set({
                title: body.title,
                publishedAt: body.publishedAt,
                pdfUrl: body.pdfKey
                    ? await publishAsset(bucket, body.pdfKey)
                    : undefined,
                imageUrl,
            })
            .where(eq(schema.toddel.edition, edition))
            .returning();

        if (!issue) {
            throw HTTPAppException.InternalError("Failed to update issue");
        }

        return c.json(
            {
                edition: issue.edition,
                title: issue.title,
                imageUrl: issue.imageUrl,
                pdfUrl: issue.pdfUrl,
                publishedAt: issue.publishedAt,
            },
            200,
        );
    },
);
