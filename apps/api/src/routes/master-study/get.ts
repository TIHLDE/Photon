import { validator } from "hono-openapi";
import {
    getMasterStudyEntryOr404,
    toMasterStudyEntryResponse,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { entryIdParamSchema, masterStudyEntrySchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Get master study entry",
        operationId: "getMasterStudyEntry",
        description:
            "Get one master study entry with its quotes. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyEntrySchema,
            description: "OK",
        })
        .notFound({ description: "Master study entry not found" })
        .build(),
    validator("param", entryIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");

        const entry = await getMasterStudyEntryOr404(db, id);

        return c.json(toMasterStudyEntryResponse(entry));
    },
);
