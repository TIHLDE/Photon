import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    findAlbumEvent,
    generateUniqueAlbumSlug,
    serializeAlbum,
} from "~/lib/gallery";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createGallerySchema, gallerySchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["gallery"],
        summary: "Create gallery",
        operationId: "createGallery",
        description:
            "Create a new photo album. Requires 'galleries:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: gallerySchema,
            description: "Album created",
        })
        .forbidden({ description: "Insufficient permissions" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["galleries:create", "galleries:manage"] }),
    validator("json", createGallerySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const body = c.req.valid("json");
        const userId = c.get("user").id;

        const slug = await generateUniqueAlbumSlug(ctx, body.title);

        const [album] = await ctx.db
            .insert(schema.galleryAlbum)
            .values({
                slug,
                title: body.title,
                description: body.description ?? null,
                imageUrl: body.imageUrl ?? null,
                imageAlt: body.imageAlt ?? null,
                eventId: body.eventId ?? null,
                createdById: userId,
            })
            .returning();

        if (!album) {
            throw new HTTPException(500, {
                message: "Kunne ikke opprette galleriet",
            });
        }

        const event = await findAlbumEvent(ctx, album.eventId);

        return c.json(serializeAlbum(album, 0, event), 201);
    },
);
