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
