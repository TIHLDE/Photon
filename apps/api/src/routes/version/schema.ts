import z from "zod";
import { Schema } from "~/lib/openapi";

export const versionResponseSchema = Schema(
    "Version",
    z.object({
        version: z.string().meta({
            description:
                "Release tag the image was built from, e.g. '2026-08-22.release-1'. 'unknown' when the image did not come from the release pipeline.",
        }),
        commit: z.string().meta({
            description:
                "Commit the image was built from, or 'unknown' outside the release pipeline.",
        }),
        startedAt: z.string().meta({
            description: "When this process booted (ISO 8601).",
        }),
        uptimeSeconds: z.number().meta({
            description: "Seconds since this process booted.",
        }),
    }),
);
