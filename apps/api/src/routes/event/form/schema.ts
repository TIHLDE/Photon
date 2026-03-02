import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== SHARED SUB-SCHEMAS =====

export const eventFormTypeSchema = z.enum(["survey", "evaluation"]);

const formFieldSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    type: z.enum(["text_answer", "multiple_select", "single_select"]),
    required: z.boolean(),
    order: z.number(),
    options: z.array(
        z.object({
            id: z.uuid(),
            title: z.string(),
            order: z.number(),
        }),
    ),
});

// ===== INPUT SCHEMAS =====

export const eventFormParamsSchema = z.object({
    eventId: z.uuid(),
    type: eventFormTypeSchema,
});

// ===== RESPONSE SCHEMAS =====

export const eventFormDetailSchema = Schema(
    "EventFormDetail",
    z.object({
        id: z.uuid(),
        title: z.string(),
        description: z.string().nullable(),
        type: eventFormTypeSchema,
        resource_type: z.string(),
        viewer_has_answered: z.boolean(),
        website_url: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
        fields: z.array(formFieldSchema),
    }),
);

export const eventFormListSchema = Schema(
    "EventFormList",
    z.array(
        z.object({
            id: z.uuid(),
            title: z.string(),
            description: z.string().nullable(),
            type: eventFormTypeSchema,
            resource_type: z.string(),
            viewer_has_answered: z.boolean(),
            created_at: z.string(),
            updated_at: z.string(),
        }),
    ),
);

export const createEventFormResponseSchema = Schema(
    "CreateEventFormResponse",
    z.object({
        id: z.uuid().optional(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        type: eventFormTypeSchema,
        resource_type: z.string(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        fields: z.array(formFieldSchema).optional(),
    }),
);
