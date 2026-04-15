import { sendCustomEmailSchema } from "@photon/email/schema";
import { z } from "zod";
import { Schema } from "~/lib/openapi";

export const sendCustomEmailInputSchema = Schema(
    "SendCustomEmail",
    sendCustomEmailSchema,
);

// ===== RESPONSE SCHEMAS =====

export const sendEmailResponseSchema = Schema(
    "SendEmailResponse",
    z.object({
        success: z.boolean(),
        message: z.string(),
        jobIds: z.array(z.string()),
        recipientCount: z.number(),
    }),
);
