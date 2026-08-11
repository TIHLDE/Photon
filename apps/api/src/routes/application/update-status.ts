import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import {
    ALL_MANAGE_PERMISSIONS,
    accessCovers,
    applicationGroupSlug,
    manageableApplicationAccess,
} from "~/lib/application/access";
import { applicationStatusLabels } from "~/lib/application/labels";
import { findApplicationById } from "~/lib/application/service";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { notifyApplicationDecided } from "./notify";
import {
    applicationDetailSchema,
    updateApplicationStatusSchema,
} from "./schema";
import { serializeApplicationDetail } from "./serialize";

export const updateStatusRoute = route().patch(
    "/:id/status",
    describeRoute({
        tags: ["applications"],
        summary: "Update an application's status",
        operationId: "updateApplicationStatus",
        description:
            "Sets the processing status and optional internal note. Approving or rejecting emails the submitter; moving to 'under behandling' does not.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: applicationDetailSchema,
            description: "The updated application",
        })
        .notFound()
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    // Cheap gate; the type-specific check happens once the row is loaded.
    requireAccess({ permission: ALL_MANAGE_PERMISSIONS }),
    validator("json", updateApplicationStatusSchema),
    async (c) => {
        const body = c.req.valid("json");
        const ctx = c.get("ctx");
        const logger = c.get("logger");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const existing = await findApplicationById(ctx, c.req.param("id"));
        if (!existing) throw HTTPAppException.NotFound("Søknad");

        const canManage = accessCovers(
            await manageableApplicationAccess(ctx, user.id),
            existing.type,
            applicationGroupSlug(existing),
        );
        if (!canManage) {
            throw HTTPAppException.Forbidden(
                "Du kan ikke behandle denne typen søknad",
            );
        }

        const isDecision =
            body.status === "approved" || body.status === "rejected";

        // A bedrift is not a submitter with a "Mine søknader" page, and an
        // automated "Henvendelse fra bedrift er avslått" would be the wrong
        // way to answer one. The Næringslivsminister replies by email.
        const notifiesSubmitter = existing.type !== "company_contact";

        await ctx.db
            .update(schema.application)
            .set({
                status: body.status,
                internalComment:
                    body.internalComment === undefined
                        ? existing.internalComment
                        : body.internalComment,
                handledById: user.id,
                handledAt: new Date(),
            })
            .where(eq(schema.application.id, existing.id));

        const updated = await findApplicationById(ctx, existing.id);
        if (!updated) throw HTTPAppException.NotFound("Søknad");

        // Only final decisions are worth an email; "under behandling" is noise.
        if (
            notifiesSubmitter &&
            isDecision &&
            body.status !== existing.status
        ) {
            await notifyApplicationDecided(ctx, logger, updated, {
                approved: body.status === "approved",
                statusLabel: applicationStatusLabels[body.status],
                message: body.messageToSubmitter,
            });
        }

        return c.json(serializeApplicationDetail(updated, true), 200);
    },
);
