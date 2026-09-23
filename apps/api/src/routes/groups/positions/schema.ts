import { PERMISSIONS_SET, isGroupScopablePermission } from "@photon/auth/rbac";
import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

const permissionListSchema = z
    .array(
        z
            .string()
            .max(64)
            .refine((p) => PERMISSIONS_SET.has(p), {
                message: "Unknown permission",
            }),
    )
    .max(100)
    .meta({
        description:
            "Permissions granted to holders of this position. Must be valid permission names from the registry.",
    });

export const GLOBAL_LIST_ON_GLOBAL_VERV =
    "A global verv already applies across TIHLDE; put the permissions in its main list";

export const NOT_GROUP_SCOPABLE =
    "Only applies across all of TIHLDE and cannot be granted for a single group";

const groupPermissionListSchema = z
    .array(
        z
            .string()
            .max(64)
            .refine((p) => PERMISSIONS_SET.has(p), {
                message: "Unknown permission",
            })
            .refine(isGroupScopablePermission, {
                message: NOT_GROUP_SCOPABLE,
            }),
    )
    .max(100);

export const createPositionSchema = Schema(
    "CreateGroupPosition",
    z
        .object({
            name: z.string().min(1).max(128).meta({
                description: "Position name, e.g. 'Økonomiansvarlig'",
            }),
            description: z
                .string()
                .max(1000)
                .optional()
                .meta({ description: "Optional description of the position" }),
            permissions: permissionListSchema,
            scope: z.enum(["group", "global"]).default("group").meta({
                description:
                    "Whether permissions apply only within this group, or globally (global requires roles:create)",
            }),
            globalPermissions: permissionListSchema.default([]).meta({
                description:
                    "Held across all of TIHLDE by holders of this group-scoped verv, e.g. job postings for NoKs Annonsør. Requires holding each of them globally yourself. Must be empty on a global verv.",
            }),
        })
        .superRefine((body, issue) => {
            if (body.scope === "global") {
                if (body.globalPermissions.length > 0) {
                    issue.addIssue({
                        code: "custom",
                        path: ["globalPermissions"],
                        message: GLOBAL_LIST_ON_GLOBAL_VERV,
                    });
                }
                return;
            }
            body.permissions.forEach((permission, index) => {
                if (!isGroupScopablePermission(permission)) {
                    issue.addIssue({
                        code: "custom",
                        path: ["permissions", index],
                        message: NOT_GROUP_SCOPABLE,
                    });
                }
            });
        }),
);

export const updatePositionSchema = Schema(
    "UpdateGroupPosition",
    z.object({
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(1000).nullable().optional(),
        permissions: permissionListSchema.optional(),
        scope: z.enum(["group", "global"]).optional(),
        globalPermissions: permissionListSchema.optional().meta({
            description:
                "Held across all of TIHLDE by holders of this group-scoped verv, e.g. job postings for NoKs Annonsør. Requires holding each of them globally yourself. Must be empty on a global verv.",
        }),
    }),
);

export const updateLeaderPermissionsSchema = Schema(
    "UpdateGroupLeaderPermissions",
    z.object({
        permissions: groupPermissionListSchema.meta({
            description:
                "Permissions the group's leader holds, scoped to this group. Replaces the existing list. Only permissions that can apply to a single group are accepted.",
        }),
        globalPermissions: permissionListSchema.optional().meta({
            description:
                "Permissions the group's leader holds across all of TIHLDE. Replaces the existing list. Requires holding each permission globally yourself. Omit to leave unchanged.",
        }),
        title: z.string().min(1).max(128).nullable().optional().meta({
            description:
                "What this group calls its leader, e.g. 'President'. Null clears it back to 'Leder'. Omit to leave unchanged.",
        }),
    }),
);

export const updateMemberPermissionsSchema = Schema(
    "UpdateGroupMemberPermissions",
    z.object({
        permissions: groupPermissionListSchema.meta({
            description:
                "Permissions every member of this group holds, scoped to this group. Replaces the existing list. Only permissions that can apply to a single group are accepted.",
        }),
        globalPermissions: permissionListSchema.meta({
            description:
                "Permissions every member of this group holds across all of TIHLDE. Replaces the existing list. Requires holding each permission globally yourself.",
        }),
    }),
);

export const assignPositionSchema = Schema(
    "AssignGroupPosition",
    z.object({
        userId: z
            .string()
            .max(255)
            .meta({ description: "User to assign the position to" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const positionHolderSchema = Schema(
    "GroupPositionHolder",
    z.object({
        userId: z.string().meta({ description: "Holder's user ID" }),
        name: z.string().nullable().meta({ description: "Holder's name" }),
        image: z
            .string()
            .nullable()
            .meta({ description: "Holder's profile image" }),
    }),
);

export const positionSchema = Schema(
    "GroupPosition",
    z.object({
        id: z.string().meta({ description: "Position ID" }),
        groupSlug: z.string().meta({ description: "Group slug" }),
        name: z.string().meta({ description: "Position name" }),
        description: z.string().nullable(),
        permissions: z.array(z.string()),
        scope: z.enum(["group", "global"]),
        globalPermissions: z.array(z.string()),
        linkedGroupSlug: z.string().nullable().meta({
            description:
                "If set, this position is held automatically by the leader of the given subgroup and cannot be assigned manually.",
        }),
        holders: z.array(positionHolderSchema).meta({
            description:
                "Everyone holding this position. A verv may be shared by several people (issue #646); empty when nobody holds it.",
        }),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const positionListSchema = Schema(
    "GroupPositionList",
    z.array(positionSchema),
);

export const leaderPermissionsSchema = Schema(
    "GroupLeaderPermissions",
    z.object({
        permissions: z.array(z.string()).meta({
            description:
                "Permissions held by whoever currently leads this group, scoped to this group.",
        }),
        globalPermissions: z.array(z.string()).meta({
            description:
                "Permissions held by whoever currently leads this group across all of TIHLDE, unscoped.",
        }),
        title: z.string().nullable().meta({
            description:
                "What this group calls its leader, e.g. 'President'. Null when the group has no custom title and the leader is simply «Leder».",
        }),
    }),
);

export const memberPermissionsSchema = Schema(
    "GroupMemberPermissions",
    z.object({
        permissions: z.array(z.string()).meta({
            description:
                "Permissions held by every member of this group, scoped to this group.",
        }),
        globalPermissions: z.array(z.string()).meta({
            description:
                "Permissions held by every member of this group across all of TIHLDE, unscoped.",
        }),
    }),
);

export const positionMessageSchema = Schema(
    "GroupPositionMessage",
    z.object({ message: z.string() }),
);
