import {
    ALL_MANAGE_PERMISSIONS,
    accessCovers,
    applicationGroupSlug,
    manageableApplicationAccess,
} from "~/lib/application/access";
import {
    findApplicationById,
    generateApplicationPdf,
} from "~/lib/application/service";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { authorizeApplicationRead } from "./get";
import { regeneratePdfResponseSchema } from "./schema";

/** Everything here is a private asset, so nothing may be cached publicly. */
function privateFileResponse(
    content: Buffer,
    contentType: string,
    filename: string,
): Response {
    return new Response(new Uint8Array(content), {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": content.length.toString(),
            "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
            "Cache-Control": "private, no-store",
        },
    });
}

export const getPdfRoute = route().get(
    "/:id/pdf",
    describeRoute({
        tags: ["applications"],
        summary: "Download an application's PDF",
        operationId: "getApplicationPdf",
        description:
            "Streams the generated PDF. Available to the submitter and to handlers of that application type.",
    })
        .response({ statusCode: 200, description: "The application PDF" })
        .notFound({ description: "Unknown application, or no PDF generated" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const application = await findApplicationById(ctx, c.req.param("id"));
        if (!application) throw HTTPAppException.NotFound("Søknad");

        await authorizeApplicationRead(ctx, application, user.id);

        if (!application.pdfAssetKey) {
            throw HTTPAppException.NotFound("PDF");
        }

        const content = await ctx.bucket.download(application.pdfAssetKey);
        return privateFileResponse(
            content,
            "application/pdf",
            `soknad-${application.id}.pdf`,
        );
    },
);

export const getAttachmentRoute = route().get(
    "/:id/attachments/:assetKey{.+}",
    describeRoute({
        tags: ["applications"],
        summary: "Download an application attachment",
        operationId: "getApplicationAttachment",
        description:
            "Streams one of an application's attachments. Available to the submitter and to handlers of that application type.",
    })
        .response({ statusCode: 200, description: "The attachment" })
        .notFound({ description: "Unknown application or attachment" })
        .unauthorized()
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const application = await findApplicationById(ctx, c.req.param("id"));
        if (!application) throw HTTPAppException.NotFound("Søknad");

        await authorizeApplicationRead(ctx, application, user.id);

        // Only keys that actually belong to this application — otherwise the
        // route would serve any private asset to anyone who can read any
        // søknad.
        const assetKey = c.req.param("assetKey");
        const attachment = application.attachments.find(
            (candidate) => candidate.assetKey === assetKey,
        );
        if (!attachment) throw HTTPAppException.NotFound("Vedlegg");

        const asset = await ctx.bucket.getAsset(assetKey);
        const content = await ctx.bucket.download(assetKey);

        return privateFileResponse(
            content,
            asset?.contentType ?? "application/octet-stream",
            asset?.originalFilename ?? "vedlegg",
        );
    },
);

/**
 * Repair path for a submission whose PDF failed to render — a malformed
 * attachment must never cost us the søknad itself.
 */
export const regeneratePdfRoute = route().post(
    "/:id/pdf/regenerate",
    describeRoute({
        tags: ["applications"],
        summary: "Regenerate an application's PDF",
        operationId: "regenerateApplicationPdf",
        description:
            "Re-renders and stores the PDF for an application. Used when generation failed at submission time.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: regeneratePdfResponseSchema,
            description: "The new PDF asset key",
        })
        .notFound()
        .unauthorized()
        .forbidden()
        .build(),
    requireAuth,
    requireAccess({ permission: ALL_MANAGE_PERMISSIONS }),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        if (!user) throw HTTPAppException.Unauthorized();

        const application = await findApplicationById(ctx, c.req.param("id"));
        if (!application) throw HTTPAppException.NotFound("Søknad");

        const canManage = accessCovers(
            await manageableApplicationAccess(ctx, user.id),
            application.type,
            applicationGroupSlug(application),
        );
        if (!canManage) {
            throw HTTPAppException.Forbidden(
                "Du kan ikke behandle denne typen søknad",
            );
        }

        // Bedriftshenvendelser never had a PDF to begin with, so this would
        // fail deep inside the renderer instead of saying why.
        if (application.type === "company_contact") {
            throw HTTPAppException.BadRequest(
                "Bedriftshenvendelser har ingen PDF",
            );
        }

        const pdfAssetKey = await generateApplicationPdf(ctx, application);
        return c.json({ pdfAssetKey }, 200);
    },
);
