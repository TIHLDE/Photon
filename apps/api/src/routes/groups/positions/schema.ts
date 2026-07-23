import { PERMISSIONS_SET } from "@photon/auth/rbac";
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

export const createPositionSchema = Schema(
    "CreateGroupPosition",
    z.object({
        name: z
            .string()
            .min(1)
            .max(128)
            .meta({ description: "Position name, e.g. 'Økonomiansvarlig'" }),
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
    }),
);

export const updatePositionSchema = Schema(
    "UpdateGroupPosition",
    z.object({
        name: z.string().min(1).max(128).optional(),
        description: z.string().max(1000).nullable().optional(),
        permissions: permissionListSchema.optional(),
        scope: z.enum(["group", "global"]).optional(),
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
        holder: positionHolderSchema.nullable().meta({
            description: "The single holder of this position, if assigned",
        }),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const positionListSchema = Schema(
    "GroupPositionList",
    z.array(positionSchema),
);

export const positionMessageSchema = Schema(
    "GroupPositionMessage",
    z.object({ message: z.string() }),
);
