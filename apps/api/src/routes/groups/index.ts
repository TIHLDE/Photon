import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPAppException } from "~/lib/errors";
import { route } from "~/lib/route";
import { archiveRoute } from "./archive";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { finesRoutes } from "./fines";
import { lawsRoutes } from "./laws";
import { createGroupFormRoute } from "./form/create";
import { listGroupFormsRoute } from "./form/list";
import { getRoute } from "./get";
import { joinRequestsRoutes } from "./join-requests";
import { listRoute } from "./list";
import { membersRoutes } from "./members";
import { mineRoute } from "./mine";
import { positionsRoutes } from "./positions";
import { updateRoute } from "./update";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Nothing in an archived group can be changed. One guard in front of every
 * route below instead of a check in each handler, so a route added later is
 * covered without anyone remembering to. Restoring and deleting are the two
 * ways out and stay open.
 */
const blockWritesWhenArchived = createMiddleware(async (c, next) => {
    const slug = c.req.param("slug");
    const slugIndex = c.req.routePath.split("/").indexOf(":slug");
    const rest = c.req.path
        .split("/")
        .slice(slugIndex + 1)
        .join("/");
    const isWayOut =
        rest === "unarchive" || (c.req.method === "DELETE" && rest === "");

    if (slug && !READ_METHODS.has(c.req.method) && !isWayOut) {
        const [group] = await c
            .get("ctx")
            .db.select({ archivedAt: schema.group.archivedAt })
            .from(schema.group)
            .where(eq(schema.group.slug, slug))
            .limit(1);

        if (group?.archivedAt) {
            throw HTTPAppException.Conflict(
                "Gruppen er arkivert. Gjenopprett den for å gjøre endringer.",
            );
        }
    }

    await next();
});

export const groupsRoutes = route()
    // Matches "/:slug" itself too, so one registration covers every route.
    .use("/:slug/*", blockWritesWhenArchived)
    .route("/", listRoute)
    .route("/", mineRoute)
    .route("/", archiveRoute)
    .route("/", createRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute)
    .route("/", getRoute)
    .route("/", finesRoutes)
    .route("/", lawsRoutes)
    .route("/", membersRoutes)
    .route("/", joinRequestsRoutes)
    .route("/", positionsRoutes)
    .route("/", createGroupFormRoute)
    .route("/", listGroupFormsRoute);
