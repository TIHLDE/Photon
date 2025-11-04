import { z } from "zod";

// ===== FIELD & OPTION SCHEMAS =====

export const createOptionSchema = z.object({
    title: z.string().max(400),
    order: z.number().int().min(0).default(0),
});

export const updateOptionSchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().max(400),
    order: z.number().int().min(0).default(0),
});

export const createFieldSchema = z.object({
    title: z.string().max(400),
    type: z.enum(["text_answer", "multiple_select", "single_select"]),
    required: z.boolean().default(false),
    order: z.number().int().min(0).default(0),
    options: z.array(createOptionSchema).optional(),
});

export const updateFieldSchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().max(400),
    type: z.enum(["text_answer", "multiple_select", "single_select"]),
    required: z.boolean().default(false),
    order: z.number().int().min(0).default(0),
    options: z.array(updateOptionSchema).optional(),
});

// ===== BASE FORM SCHEMAS =====

export const createFormSchema = z.object({
    title: z.string().max(400),
    description: z.string().optional(),
    template: z.boolean().default(false),
    fields: z.array(createFieldSchema).optional().default([]),
});

export const updateFormSchema = z.object({
    title: z.string().max(400).optional(),
    description: z.string().optional(),
    template: z.boolean().optional(),
    fields: z.array(updateFieldSchema).optional(),
});

// ===== EVENT FORM SCHEMAS =====

export const createEventFormSchema = createFormSchema.extend({
    event: z.string().uuid(),
    type: z.enum(["survey", "evaluation"]),
});

export const updateEventFormSchema = updateFormSchema.extend({
    type: z.enum(["survey", "evaluation"]).optional(),
});

// ===== GROUP FORM SCHEMAS =====

export const createGroupFormSchema = createFormSchema.extend({
    group: z.string().max(128),
    email_receiver_on_submit: z.string().email().optional(),
    can_submit_multiple: z.boolean().default(true),
    is_open_for_submissions: z.boolean().default(false),
    only_for_group_members: z.boolean().default(false),
});

export const updateGroupFormSchema = updateFormSchema.extend({
    email_receiver_on_submit: z.string().email().optional(),
    can_submit_multiple: z.boolean().optional(),
    is_open_for_submissions: z.boolean().optional(),
    only_for_group_members: z.boolean().optional(),
});

// ===== SUBMISSION SCHEMAS =====

export const createAnswerSchema = z
    .object({
        field: z.object({
            id: z.string().uuid(),
        }),
        answer_text: z.string().optional(),
        selected_options: z
            .array(
                z.object({
                    id: z.string().uuid(),
                }),
            )
            .optional(),
    })
    .refine(
        (data) => {
            // Must have either answer_text OR selected_options, not both
            const hasText = !!data.answer_text;
            const hasOptions =
                !!data.selected_options && data.selected_options.length > 0;
            return (hasText && !hasOptions) || (!hasText && hasOptions);
        },
        {
            message:
                "Answer must have either answer_text or selected_options, not both",
        },
    );

export const createSubmissionSchema = z.object({
    answers: z.array(createAnswerSchema),
});

export const deleteSubmissionWithReasonSchema = z.object({
    reason: z.string().min(1, "Reason is required"),
});

// ===== TYPES =====

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type CreateEventFormInput = z.infer<typeof createEventFormSchema>;
export type UpdateEventFormInput = z.infer<typeof updateEventFormSchema>;
export type CreateGroupFormInput = z.infer<typeof createGroupFormSchema>;
export type UpdateGroupFormInput = z.infer<typeof updateGroupFormSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;
