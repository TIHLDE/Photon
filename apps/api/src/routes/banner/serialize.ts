import type { Banner } from "@photon/db/schema";
import type z from "zod";
import type { bannerSchema } from "./schema";

/** Map a DB row to the admin-facing banner response shape. */
export function serializeBanner(
    row: Banner,
    now: Date = new Date(),
): z.infer<typeof bannerSchema> {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        url: row.url ?? null,
        linkText: row.linkText ?? null,
        visibleFrom: row.visibleFrom.toISOString(),
        visibleUntil: row.visibleUntil.toISOString(),
        isVisible: row.visibleFrom <= now && now < row.visibleUntil,
        createdById: row.createdById ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
