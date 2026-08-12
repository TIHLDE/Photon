import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuthOrApiKey } from "~/middleware/auth-or-api-key";
import { metadataResponseSchema } from "./schema";

/**
 * Claim an upload so the cleanup cron stops counting the days on it.
 *
 * Routes inside Photon promote through {@link promoteAssetUrls} when they store
 * a URL, and the cron's reference check rescues the ones that forget. Neither
 * helps an app with its own database: kontres stores the URL in its own
 * `FAQ.imageUrl`, which nothing here can see, so the picture would be deleted
 * two days after it was uploaded with no warning anywhere.
 *
 * Only the uploader may promote, which is all an external client needs — it
 * uploaded the file moments earlier with the same token. That also keeps this
 * from becoming a way to pin down someone else's staged upload.
 */
/**
 * The key is a path (`uploads/2026/08/uuid_name.webp`), so it has to be the
 * last segment: a `:key{.+}` followed by a literal `/promote` never matches,
 * because the greedy parameter swallows the suffix and the router does not
 * backtrack. `GET /metadata/:key` solved it the same way.
 */
export const promoteRoute = route().post(
    "/promote/:key{.+}",
    describeRoute({
        tags: ["assets"],
        summary: "Promote an uploaded asset",
        operationId: "promoteAsset",
        description: `Mark an uploaded asset as claimed so it survives the staging cleanup that deletes unclaimed uploads after 2 days.

The key is the full path returned when uploading, e.g. \`uploads/2026/08/uuid_filename.webp\`.

Call this once the URL has been stored somewhere permanent. Routes within Photon do it for you; external clients that keep the URL in their own database must call it themselves.

Only the account that uploaded the asset may promote it. Promoting an already-promoted asset is a no-op and still answers 200.`,
    })
        .schemaResponse({
            statusCode: 200,
            schema: metadataResponseSchema,
            description: "Asset promoted",
        })
        .notFound({ description: "Asset not found" })
        .unauthorized()
        .errorResponses([
            HTTPAppException.Forbidden(
                "Du kan bare promotere filer du selv har lastet opp.",
            ),
        ])
        .build(),
    requireAuthOrApiKey,
    async (c) => {
        const { bucket } = c.get("ctx");
        const key = c.req.param("key");

        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.NotFound("Asset");
        }

        const user = c.get("user");
        const apiKey = c.get("apiKey");
        const callerId = user?.id ?? apiKey?.createdById;

        if (!callerId || asset.uploadedById !== callerId) {
            throw HTTPAppException.Forbidden(
                "Du kan bare promotere filer du selv har lastet opp.",
            );
        }

        // Already "ready" is the normal outcome of a client retrying, so it is
        // not an error — but there is also nothing to write.
        const promoted =
            asset.status === "ready" ? asset : await bucket.promoteAsset(key);

        if (!promoted) {
            throw HTTPAppException.NotFound("Asset");
        }

        return c.json({
            id: promoted.id,
            key: promoted.key,
            originalFilename: promoted.originalFilename,
            contentType: promoted.contentType,
            size: promoted.size,
            status: promoted.status,
            promotedAt: promoted.promotedAt?.toISOString() ?? null,
            createdAt: promoted.createdAt.toISOString(),
        });
    },
);
