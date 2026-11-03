import z from "zod";
import { Schema } from "~/lib/openapi";

export const updateUserEmailInputSchema = Schema(
    "UpdateUserEmailInput",
    z.object({
        email: z.string().trim().toLowerCase().email().meta({
            description: "The member's new address",
        }),
    }),
);

export const updateUserEmailResponseSchema = Schema(
    "UpdateUserEmail",
    z.object({
        message: z.string(),
        email: z.string(),
    }),
);
