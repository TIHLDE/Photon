import z from "zod";
import { Schema } from "~/lib/openapi";
import { PagniationResponseSchema } from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

export const createGallerySchema = Schema(
    "CreateGallery",
    z.object({
        title: z
            .string()
            .min(1)
            .max(100)
            .meta({ description: "Album title, e.g. 'Julebord 2025'" }),
        description: z
            .string()
            .max(5000)
            .optional()
            .meta({ description: "Optional description shown on the album" }),
        imageUrl: z
            .url()
            .optional()
            .meta({ description: "Cover image shown in the album list" }),
        imageAlt: z
            .string()
            .max(200)
            .optional()
            .meta({ description: "Alt text for the cover image" }),
        eventId: z.uuid().optional().meta({
            description: "Arrangement the pictures are from, if any",
        }),
    }),
);

export const updateGallerySchema = Schema(
    "UpdateGallery",
    z.object({
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(5000).optional().nullable(),
        imageUrl: z.url().optional().nullable(),
        imageAlt: z.string().max(200).optional().nullable(),
        eventId: z.uuid().optional().nullable(),
    }),
);

export const galleryListQuerySchema = z.object({
    search: z
        .string()
        .optional()
        .describe("Free-text search across title and description"),
});

const pictureInputSchema = z.object({
    imageUrl: z.url().meta({ description: "URL of the uploaded image" }),
    imageAlt: z.string().max(200).optional(),
    title: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
});

/**
 * Pictures are added in bulk — the admin UI uploads a whole batch of files at
 * once, the same way Lepton's `POST /gallery/{id}/pictures` accepted a file
 * list.
 */
export const createGalleryPicturesSchema = Schema(
    "CreateGalleryPictures",
    z.object({
        pictures: z
            .array(pictureInputSchema)
            .min(1)
            .max(100)
            .meta({ description: "Pictures to add to the album" }),
    }),
);

export const updateGalleryPictureSchema = Schema(
    "UpdateGalleryPicture",
    z.object({
        imageAlt: z.string().max(200).optional().nullable(),
        title: z.string().max(100).optional().nullable(),
        description: z.string().max(5000).optional().nullable(),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const gallerySchema = Schema(
    "Gallery",
    z.object({
        id: z.uuid().meta({ description: "Album ID" }),
        slug: z.string().meta({ description: "Public URL slug" }),
        title: z.string().meta({ description: "Album title" }),
        description: z.string().nullable(),
        imageUrl: z
            .string()
            .nullable()
            .meta({ description: "Cover image URL" }),
        imageAlt: z.string().nullable(),
        pictureCount: z
            .number()
            .meta({ description: "Number of pictures in the album" }),
        event: z
            .object({
                id: z.uuid(),
                title: z.string(),
                slug: z.string(),
                start: z
                    .string()
                    .meta({ description: "Start time (ISO 8601)" }),
            })
            .nullable()
            .meta({
                description: "Arrangement the album belongs to, if any",
            }),
        createdById: z.string().nullable(),
        createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z
            .string()
            .meta({ description: "Last update time (ISO 8601)" }),
    }),
);

export const galleryListResponseSchema = Schema(
    "GalleryList",
    PagniationResponseSchema.extend({
        items: z.array(gallerySchema).describe("List of albums"),
    }),
);

export const galleryPictureSchema = Schema(
    "GalleryPicture",
    z.object({
        id: z.uuid().meta({ description: "Picture ID" }),
        albumId: z.uuid().meta({ description: "Album the picture belongs to" }),
        imageUrl: z.string().meta({ description: "Image URL" }),
        imageAlt: z.string().nullable(),
        title: z.string().nullable(),
        description: z.string().nullable(),
        createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z
            .string()
            .meta({ description: "Last update time (ISO 8601)" }),
    }),
);

export const galleryPictureListResponseSchema = Schema(
    "GalleryPictureList",
    PagniationResponseSchema.extend({
        items: z.array(galleryPictureSchema).describe("List of pictures"),
    }),
);

export const createGalleryPicturesResponseSchema = Schema(
    "CreateGalleryPicturesResponse",
    z.object({
        created: z.number().meta({ description: "Number of pictures added" }),
        items: z.array(galleryPictureSchema),
    }),
);

export const deleteGalleryResponseSchema = Schema(
    "DeleteGalleryResponse",
    z.object({ message: z.string() }),
);

export const deleteGalleryPictureResponseSchema = Schema(
    "DeleteGalleryPictureResponse",
    z.object({ message: z.string() }),
);
