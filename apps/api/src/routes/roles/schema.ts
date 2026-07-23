import { PERMISSIONS_SET } from "@photon/auth/rbac";
import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

const rolePermissionListSchema = z
    .array(
        z
            .string()
            .max(64)
            .refine((p) => PERMISSIONS_SET.has(p), {
                message: "Unknown permission",
            }),
    )
    .max(100)
    .meta({ description: "Permissions granted by this role" });

export const createRoleSchema = Schema(
    "CreateRole",
    z.object({
        name: z
            .string()
            .min(1)
            .max(64)
            .meta({ description: "Unique role name" }),
        description: z.string().max(256).optional(),
        permissions: rolePermissionListSchema.default([]),
    }),
);

export const updateRoleSchema = Schema(
    "UpdateRole",
    z.object({
        name: z.string().min(1).max(64).optional(),
        description: z.string().max(256).nullable().optional(),
        permissions: rolePermissionListSchema.optional(),
    }),
);

export const assignRoleSchema = Schema(
    "AssignRole",
    z.object({
        userId: z.string().max(255).meta({ description: "User to assign" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const roleUserSchema = Schema(
    "RoleUser",
    z.object({
        userId: z.string(),
        name: z.string().nullable(),
        image: z.string().nullable(),
    }),
);

export const roleSchema = Schema(
    "Role",
    z.object({
        id: z.number(),
        name: z.string(),
        description: z.string().nullable(),
        position: z.number(),
        permissions: z.array(z.string()),
        users: z.array(roleUserSchema),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const roleListSchema = Schema("RoleList", z.array(roleSchema));

export const roleMessageSchema = Schema(
    "RoleMessage",
    z.object({ message: z.string() }),
);
