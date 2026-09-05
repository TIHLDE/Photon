import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { assetKeyFromUrl } from "~/lib/asset";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { captureAuth } from "~/middleware/auth";
import { canViewFines, requireFinesGroup } from "./permissions";

// 404 og ikke 403 på alle avslag: en 403 ville bekreftet at boten finnes og
// har et bilde, og det er nettopp det en utenforstående ikke skal lære.
function notFound(): HTTPException {
    return new HTTPException(404, { message: "Fine image not found" });
}

export const getFineImageRoute = route().get(
    "/:groupSlug/fines/:fineId/image",
    describeRoute({
        tags: ["fines"],
        summary: "Download a fine's evidence picture",
        operationId: "getFineImage",
        description: `Streams the picture attached to a fine.

Fine pictures are private assets: \`GET /api/assets/:key\` refuses to serve
them, and this route is the only way to read one. The rule is the same one
that governs the fine itself — the member it was given to, the member who gave
it, any member of the group, the botsjef, and root.

Anything else answers 404, signed-out callers included, so the route never
confirms that a given fine or picture exists.`,
    })
        .response({
            statusCode: 200,
            description: "The picture",
        })
        .notFound({
            description:
                "No such fine or picture, or the caller may not read it",
        })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const fineId = c.req.param("fineId");

        if (!user) throw notFound();
        if (!isValidUUID(fineId)) throw notFound();

        const group = await requireFinesGroup(ctx, groupSlug);

        const fine = await ctx.db.query.fine.findFirst({
            where: eq(schema.fine.id, fineId),
            columns: {
                image: true,
                groupSlug: true,
                userId: true,
                createdByUserId: true,
            },
        });

        if (!fine || fine.groupSlug !== groupSlug) throw notFound();

        // Begge parter i boten beholder den uansett hva medlemslista sier —
        // samme regel som GET /:groupSlug/fines/:fineId.
        const isParty =
            fine.userId === user.id || fine.createdByUserId === user.id;

        if (!isParty && !(await canViewFines(ctx, user.id, group))) {
            throw notFound();
        }

        const key = fine.image ? assetKeyFromUrl(fine.image) : null;
        if (!key) throw notFound();

        const asset = await ctx.bucket.getAsset(key);

        let content: Buffer;
        try {
            content = await ctx.bucket.download(key);
        } catch {
            throw notFound();
        }

        return new Response(new Uint8Array(content), {
            status: 200,
            headers: {
                "Content-Type":
                    asset?.contentType ?? "application/octet-stream",
                "Content-Length": content.length.toString(),
                "Content-Disposition": `inline; filename="${encodeURIComponent(
                    asset?.originalFilename ?? "bot-bilde",
                )}"`,
                // Tilgangen følger medlemskap, og medlemskap endrer seg.
                "Cache-Control": "private, no-store",
            },
        });
    },
);
