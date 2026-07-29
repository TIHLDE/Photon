import z from "zod";
import { Schema } from "~/lib/openapi";

export const instituteSchema = Schema(
    "Institute",
    z.object({
        slug: z.string().meta({ description: "Institute slug, e.g. 'idi'" }),
        shortName: z
            .string()
            .meta({ description: "Short institute name, e.g. 'IDI'" }),
        name: z.string().meta({ description: "Full institute name" }),
    }),
);

export const instituteListResponseSchema = Schema(
    "InstituteList",
    z.array(instituteSchema),
);
