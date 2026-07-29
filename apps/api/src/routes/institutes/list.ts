import { schema } from "@photon/db";
import { asc } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { instituteListResponseSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["institutes"],
        summary: "List institutes",
        operationId: "listInstitutes",
        description:
            "The NTNU institutes TIHLDE's study programmes run under. Used to pick which institute an event is reserved for. Reference data — public and unpaginated, since there are only ever a couple of them.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: instituteListResponseSchema,
            description: "OK",
        })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");

        const institutes = await db.query.institute.findMany({
            columns: { slug: true, shortName: true, name: true },
            orderBy: [asc(schema.institute.shortName)],
        });

        return c.json(institutes, 200);
    },
);
