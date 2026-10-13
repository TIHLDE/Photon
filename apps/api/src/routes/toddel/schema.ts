import z from "zod";
import { Schema } from "~/lib/openapi";

export const toddelIssueSchema = Schema(
    "ToddelIssue",
    z.object({
        edition: z.number().int().meta({
            description: "Lepton's running count, not the number on the cover",
        }),
        title: z.string().meta({ description: "Title of the issue" }),
        imageUrl: z
            .string()
            .nullable()
            .meta({ description: "Cover image, if one was published" }),
        pdfUrl: z.string().meta({ description: "The issue itself, as a PDF" }),
        publishedAt: z.iso
            .date()
            .meta({ description: "Publication date (ISO 8601)" }),
    }),
);

export const toddelListResponseSchema = Schema(
    "ToddelList",
    z.array(toddelIssueSchema).describe("Every issue, newest first"),
);

/**
 * Files arrive as asset keys, never as URLs. The archive's public URLs all
 * point at this API's own `/api/assets/:key`, and letting a caller supply the
 * URL directly would make it trivial to link an issue to a file the cleanup
 * cron is still free to delete.
 */
const issueFields = {
    title: z.string().min(1).max(200).meta({
        description: "Title of the issue, e.g. “Töddel”",
    }),
    publishedAt: z.iso
        .date()
        .meta({ description: "Publication date (ISO 8601)" }),
    pdfKey: z.string().min(1).meta({
        description: "Asset key of the PDF, from POST /api/assets",
    }),
    imageKey: z.string().min(1).nullish().meta({
        description: "Asset key of the cover image, if there is one",
    }),
};

export const createToddelSchema = Schema(
    "CreateToddel",
    z.object({
        edition: z.number().int().positive().meta({
            description:
                "Running count, continuing where the archive left off — not the number printed on the cover",
        }),
        ...issueFields,
    }),
);

export const updateToddelSchema = Schema(
    "UpdateToddel",
    z
        .object(issueFields)
        .partial()
        .describe("Only the given fields are changed"),
);

export const deleteToddelResponseSchema = Schema(
    "DeleteToddelResponse",
    z.object({ message: z.string() }),
);
