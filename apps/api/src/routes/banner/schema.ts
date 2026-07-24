import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createBannerSchema = Schema(
    "CreateBanner",
    z
        .object({
            title: z
                .string()
                .min(1)
                .max(200)
                .meta({ description: "Banner headline" }),
            description: z
                .string()
                .min(1)
                .max(500)
                .meta({ description: "Short message shown in the banner" }),
            url: z
                .url()
                .optional()
                .meta({ description: "Optional link for the banner" }),
            linkText: z.string().max(100).optional().meta({
                description:
                    "Optional label for the banner link; an arrow is always shown",
            }),
            visibleFrom: z.iso
                .datetime()
                .meta({ description: "When the banner becomes visible" }),
            visibleUntil: z.iso
                .datetime()
                .meta({ description: "When the banner stops being visible" }),
        })
        .refine(
            (data) =>
                new Date(data.visibleFrom).getTime() <
                new Date(data.visibleUntil).getTime(),
            {
                message: "visibleFrom must be before visibleUntil",
                path: ["visibleUntil"],
            },
        ),
);

export const updateBannerSchema = Schema(
    "UpdateBanner",
    z.object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(500).optional(),
        url: z.url().optional().nullable(),
        linkText: z.string().max(100).optional().nullable(),
        visibleFrom: z.iso.datetime().optional(),
        visibleUntil: z.iso.datetime().optional(),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const bannerSchema = Schema(
    "Banner",
    z.object({
        id: z.uuid().meta({ description: "Banner ID" }),
        title: z.string().meta({ description: "Banner headline" }),
        description: z
            .string()
            .meta({ description: "Short message shown in the banner" }),
        url: z
            .string()
            .nullable()
            .meta({ description: "Optional link for the banner" }),
        linkText: z
            .string()
            .nullable()
            .meta({ description: "Optional label for the banner link" }),
        visibleFrom: z
            .string()
            .meta({ description: "Visibility window start (ISO 8601)" }),
        visibleUntil: z
            .string()
            .meta({ description: "Visibility window end (ISO 8601)" }),
        isVisible: z
            .boolean()
            .meta({ description: "Whether the banner is live right now" }),
        createdById: z
            .string()
            .nullable()
            .meta({ description: "Creator user ID" }),
        createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
        updatedAt: z
            .string()
            .meta({ description: "Last update time (ISO 8601)" }),
    }),
);

export const bannerListResponseSchema = Schema(
    "BannerList",
    z.array(bannerSchema).describe("All banners, newest visibility first"),
);

export const visibleBannerSchema = Schema(
    "VisibleBanner",
    z.object({
        id: z.uuid().meta({ description: "Banner ID" }),
        title: z.string().meta({ description: "Banner headline" }),
        description: z
            .string()
            .meta({ description: "Short message shown in the banner" }),
        url: z
            .string()
            .nullable()
            .meta({ description: "Optional link for the banner" }),
        linkText: z
            .string()
            .nullable()
            .meta({ description: "Optional label for the banner link" }),
        visibleUntil: z
            .string()
            .meta({ description: "Visibility window end (ISO 8601)" }),
    }),
);

export const visibleBannerListResponseSchema = Schema(
    "VisibleBannerList",
    z
        .array(visibleBannerSchema)
        .describe("Banners currently live, newest first"),
);

export const deleteBannerResponseSchema = Schema(
    "DeleteBannerResponse",
    z.object({
        message: z.string(),
    }),
);
