import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { publishAsset } from "./asset-url";
import { createToddelSchema, toddelIssueSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["toddel"],
        summary: "Publish a TÖDDEL issue",
        operationId: "createToddel",
        description:
            "Add an issue to the archive. Upload the PDF (and the cover, if there is one) via POST /api/assets first, then pass the returned keys here. Requires 'toddel:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: toddelIssueSchema,
            description: "Issue published",
        })
        .badRequest({ description: "Unknown asset key" })
        .unauthorized()
        .forbidden({ description: "Insufficient permissions" })
        .response({
            statusCode: 409,
            description: "Conflict - that edition already exists",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: ["toddel:create", "toddel:manage"] }),
    validator("json", createToddelSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, bucket } = c.get("ctx");

        const existing = await db.query.toddel.findFirst({
            where: eq(schema.toddel.edition, body.edition),
        });

        if (existing) {
            throw HTTPAppException.Conflict(
                `Edition ${body.edition} already exists. Edit it instead, or pick the next free number.`,
            );
        }

        // The PDF is what makes the row worth having, so it is resolved first:
        // a bad key fails before a cover has been promoted out of reach of the
        // cleanup cron.
        const pdfUrl = await publishAsset(bucket, body.pdfKey);
        const imageUrl = body.imageKey
            ? await publishAsset(bucket, body.imageKey)
            : null;

        const [issue] = await db
            .insert(schema.toddel)
            .values({
                edition: body.edition,
                title: body.title,
                publishedAt: body.publishedAt,
                pdfUrl,
                imageUrl,
            })
            .returning();

        if (!issue) {
            throw HTTPAppException.InternalError("Failed to create issue");
        }

        return c.json(
            {
                edition: issue.edition,
                title: issue.title,
                imageUrl: issue.imageUrl,
                pdfUrl: issue.pdfUrl,
                publishedAt: issue.publishedAt,
            },
            201,
        );
    },
);
