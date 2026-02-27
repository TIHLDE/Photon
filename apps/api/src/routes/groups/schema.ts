import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createGroupSchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(128)
        .regex(
            /^[a-z0-9-]+$/,
            "Slug must contain only lowercase letters, numbers, and hyphens",
        )
        .meta({ description: "Unique group slug identifier" }),
    imageUrl: z
        .string()
        .url()
        .max(600)
        .optional()
        .meta({ description: "Group image URL" }),
    name: z.string().min(1).max(128).meta({ description: "Group name" }),
    description: z
        .string()
        .optional()
        .meta({ description: "Group description" }),
    contactEmail: z
        .string()
        .email()
        .max(200)
        .optional()
        .meta({ description: "Group contact email" }),
    type: z.string().max(50).meta({
        description: "Group type (e.g., committee, study, interestgroup)",
    }),
    finesInfo: z
        .string()
        .default("")
        .meta({ description: "Information about group fines policy" }),
    finesActivated: z
        .boolean()
        .default(false)
        .meta({ description: "Whether fines are activated for this group" }),
    finesAdminId: z
        .string()
        .max(255)
        .optional()
        .meta({ description: "User ID of the fines administrator" }),
});

export const updateGroupSchema = z.object({
    imageUrl: z
        .string()
        .url()
        .max(600)
        .optional()
        .meta({ description: "Group image URL" }),
    name: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .meta({ description: "Group name" }),
    description: z
        .string()
        .optional()
        .nullable()
        .meta({ description: "Group description" }),
    contactEmail: z
        .string()
        .email()
        .max(200)
        .optional()
        .nullable()
        .meta({ description: "Group contact email" }),
    type: z.string().max(50).optional().meta({ description: "Group type" }),
    finesInfo: z
        .string()
        .optional()
        .meta({ description: "Information about group fines policy" }),
    finesActivated: z
        .boolean()
        .optional()
        .meta({ description: "Whether fines are activated for this group" }),
    finesAdminId: z
        .string()
        .max(255)
        .optional()
        .nullable()
        .meta({ description: "User ID of the fines administrator" }),
});

export const addMemberSchema = z.object({
    userId: z
        .string()
        .max(255)
        .meta({ description: "User ID to add as member" }),
    role: z
        .enum(["member", "leader"])
        .default("member")
        .meta({ description: "Membership role" }),
});

export const updateMemberRoleSchema = z.object({
    role: z.enum(["member", "leader"]).meta({ description: "Membership role" }),
});

// ===== RESPONSE SCHEMAS =====

export const groupSchema = Schema(
    "Group",
    z.object({
        slug: z.string().meta({ description: "Group slug" }),
        imageUrl: z
            .string()
            .nullable()
            .meta({ description: "Group image URL" }),
        name: z.string().meta({ description: "Group name" }),
        description: z
            .string()
            .nullable()
            .meta({ description: "Group description" }),
        contactEmail: z
            .string()
            .nullable()
            .meta({ description: "Group contact email" }),
        type: z.string().meta({ description: "Group type" }),
        finesInfo: z.string().meta({ description: "Group fines info" }),
        finesActivated: z
            .boolean()
            .meta({ description: "Group fines activated" }),
        finesAdminId: z
            .string()
            .nullable()
            .meta({ description: "Group fines admin ID" }),
        createdAt: z.string().meta({ description: "Creation timestamp" }),
        updatedAt: z.string().meta({ description: "Last update timestamp" }),
    }),
);

export const groupListSchema = Schema("GroupList", z.array(groupSchema));

const membershipSchema = z.object({
    role: z.enum(["member", "leader"]),
    joinedAt: z.string(),
    updatedAt: z.string(),
});

export const myGroupSchema = Schema(
    "MyGroup",
    groupSchema.extend({
        membership: membershipSchema,
    }),
);

export const myGroupsListSchema = Schema(
    "MyGroupList",
    z.array(myGroupSchema),
);

export const memberSchema = Schema(
    "GroupMember",
    z.object({
        userId: z.string().meta({ description: "User ID" }),
        groupSlug: z.string().meta({ description: "Group slug" }),
        role: z.string().meta({ description: "Membership role" }),
        createdAt: z
            .string()
            .meta({ description: "Membership creation timestamp" }),
        updatedAt: z
            .string()
            .meta({ description: "Membership update timestamp" }),
    }),
);

export const memberListSchema = Schema(
    "GroupMemberList",
    z.array(memberSchema),
);

export const membershipResponseSchema = Schema(
    "GroupMembership",
    z.object({
        userId: z.string().meta({ description: "User ID" }),
        groupSlug: z.string().meta({ description: "Group slug" }),
        role: z
            .enum(["member", "leader"])
            .meta({ description: "Membership role" }),
        createdAt: z
            .string()
            .meta({ description: "Membership creation timestamp" }),
        updatedAt: z
            .string()
            .meta({ description: "Membership update timestamp" }),
    }),
);

export const updateGroupResponseSchema = Schema(
    "UpdateGroupResponse",
    z.object({
        message: z.string(),
    }),
);

export const updateMemberRoleResponseSchema = Schema(
    "UpdateMemberRoleResponse",
    z.object({
        message: z.string(),
    }),
);

export const groupFormListSchema = Schema(
    "GroupFormList",
    z.array(
        z.object({
            id: z.uuid(),
            title: z.string(),
            description: z.string().nullable(),
            group: z.string(),
            email_receiver_on_submit: z.string().nullable(),
            can_submit_multiple: z.boolean(),
            is_open_for_submissions: z.boolean(),
            only_for_group_members: z.boolean(),
            resource_type: z.string(),
            viewer_has_answered: z.boolean(),
            created_at: z.string(),
            updated_at: z.string(),
        }),
    ),
);

const groupFormFieldSchema = z.object({
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

export const createGroupFormResponseSchema = Schema(
    "CreateGroupFormResponse",
    z.object({
        id: z.uuid().optional(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        group: z.string(),
        email_receiver_on_submit: z.string().nullable().optional(),
        can_submit_multiple: z.boolean().optional(),
        is_open_for_submissions: z.boolean().optional(),
        only_for_group_members: z.boolean().optional(),
        resource_type: z.string(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        fields: z.array(groupFormFieldSchema).optional(),
    }),
);
