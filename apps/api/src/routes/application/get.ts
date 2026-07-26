import { hasPermission } from "@photon/auth/rbac";
import { viewPermissionsFor } from "~/lib/application/access";
import { findApplicationById } from "~/lib/application/service";
import type { ApplicationWithDetails } from "~/lib/application/types";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { applicationDetailSchema } from "./schema";
import { serializeApplicationDetail } from "./serialize";

/**
 * Authorize a read of a single søknad.
 *
 * Middleware cannot do this: the required permission depends on the row's
 * type, which is only known after loading it. Same shape as
 * `streamSignedPdf` in routes/contracts/signed-pdf.ts.
 *
 * @returns whether the caller is reading as a handler (and may therefore see
 * the internal note) rather than as the submitter.
 */
export async function authorizeApplicationRead(
    ctx: AppContext,
    application: ApplicationWithDetails,
    userId: string,
): Promise<{ isHandler: boolean }> {
    const isHandler = await hasPermission(
        ctx,
        userId,
        viewPermissionsFor(application.type),
    );
    if (isHandler) return { isHandler: true };

    if (application.submittedById === userId) return { isHandler: false };

    // Don't confirm the id exists to someone with no business seeing it.
    throw HTTPAppException.NotFound("Søknad");
}

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["applications"],
        summary: "Get an application",
        operationId: "getApplication",
        description:
            "Returns a single application. Available to the submitter and to anyone with view permission for that application's type. The internal comment is only included for handlers.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: applicationDetailSchema,
            description: "The application",
        })
        .notFound({ description: "Unknown application, or not yours" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const application = await findApplicationById(ctx, c.req.param("id"));
        if (!application) throw HTTPAppException.NotFound("Søknad");

        const { isHandler } = await authorizeApplicationRead(
            ctx,
            application,
            user.id,
        );

        return c.json(serializeApplicationDetail(application, isHandler), 200);
    },
);
