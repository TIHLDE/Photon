import { z } from "zod";

const envSchema = z.object({
    FEIDE_CLIENT_ID: z.string({ description: "Feide OAuth Client ID" }),
    FEIDE_CLIENT_SECRET: z.string({ description: "Feide OAuth Client Secret" }),
});

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env = envSchema.parse(process.env);
