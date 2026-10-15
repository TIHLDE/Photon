import z from "zod";
import { Schema } from "~/lib/openapi";

export const createJoinRequestSchema = Schema(
    "CreateGroupJoinRequest",
    z.object({
        name: z.string().trim().min(1).max(100),
        message: z.string().trim().min(1).max(2000),
    }),
);

export const handleJoinRequestSchema = Schema(
    "HandleGroupJoinRequest",
    z.object({
        status: z.enum(["approved", "rejected"]).meta({
            description: "Approve adds the applicant as a regular member",
        }),
    }),
);

export const joinRequestSchema = Schema(
    "GroupJoinRequest",
    z.object({
        id: z.string(),
        status: z.enum(["pending", "approved", "rejected"]),
    }),
);

export const pendingJoinRequestListSchema = Schema(
    "PendingGroupJoinRequestList",
    z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            message: z.string(),
            createdAt: z.string(),
            user: z.object({
                id: z.string(),
                email: z.string(),
                studyProgram: z.string().nullable(),
                classYear: z.number().nullable(),
            }),
        }),
    ),
);
