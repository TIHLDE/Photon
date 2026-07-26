import { applicationTypeVariants } from "@photon/db/schema";
import { validator } from "hono-openapi";
import {
    ALL_VIEW_PERMISSIONS,
    visibleApplicationTypes,
} from "~/lib/application/access";
import { listApplications } from "~/lib/application/service";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { applicationListSchema, listApplicationsQuerySchema } from "./schema";
import { serializeApplicationSummary } from "./serialize";

/**
 * The handler inbox.
 *
 * The middleware only checks that the caller can see *some* type; the result
 * set is then narrowed to the types they actually hold permission for, so a
 * Finansminister never learns that a sak til HS exists.
 */
export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["applications"],
        summary: "List applications for handling",
        operationId: "listApplications",
        description:
            "Lists applications the caller is allowed to handle. Results are limited to the types they have view permission for.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: applicationListSchema,
            description: "Applications, newest first",
        })
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: ALL_VIEW_PERMISSIONS }),
    validator("query", listApplicationsQuerySchema),
    async (c) => {
        const query = c.req.valid("query");
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const allowed = await visibleApplicationTypes(ctx, user.id);
        const types = query.type
            ? allowed.filter((type) => type === query.type)
            : allowed;

        const applications = await listApplications(ctx, {
            types,
            status: query.status,
            limit: query.limit,
            offset: query.offset,
        });

        return c.json(applications.map(serializeApplicationSummary), 200);
    },
);

/** The submitter's own history — "Mine søknader". No permissions needed. */
export const listMineRoute = route().get(
    "/mine",
    describeRoute({
        tags: ["applications"],
        summary: "List my applications",
        operationId: "listMyApplications",
        description:
            "Lists the authenticated user's own applications and their processing status.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: applicationListSchema,
            description: "The user's applications, newest first",
        })
        .unauthorized()
        .build(),
    requireAuth,
    validator("query", listApplicationsQuerySchema),
    async (c) => {
        const query = c.req.valid("query");
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const applications = await listApplications(ctx, {
            types: query.type ? [query.type] : [...applicationTypeVariants],
            status: query.status,
            submittedById: user.id,
            limit: query.limit,
            offset: query.offset,
        });

        return c.json(applications.map(serializeApplicationSummary), 200);
    },
);
