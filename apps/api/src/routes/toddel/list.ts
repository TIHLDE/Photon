import { schema } from "@photon/db";
import { desc } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { toddelListResponseSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["toddel"],
        summary: "List TÖDDEL issues",
        operationId: "listToddel",
        description:
            "Every issue of the student magazine, newest first. Public endpoint. The archive is small and rarely changes, so it is returned unpaginated.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: toddelListResponseSchema,
            description: "OK",
        })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");

        const issues = await db.query.toddel.findMany({
            orderBy: [desc(schema.toddel.publishedAt)],
        });

        return c.json(
            issues.map((issue) => ({
                edition: issue.edition,
                title: issue.title,
                imageUrl: issue.imageUrl,
                pdfUrl: issue.pdfUrl,
                publishedAt: issue.publishedAt,
            })),
            200,
        );
    },
);
