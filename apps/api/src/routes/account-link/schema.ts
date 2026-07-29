import z from "zod";
import { Schema } from "~/lib/openapi";

export const accountLinkHelpSchema = Schema(
    "AccountLinkHelp",
    z.object({
        /**
         * Whatever Feide told the browser about them. Untrusted here — the
         * login that produced it already failed — but it is what lets a human
         * find the right account, so it is worth carrying.
         */
        feideName: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Name as Feide reported it" }),
        feideUsername: z
            .string()
            .max(100)
            .optional()
            .meta({ description: "NTNU username from the Feide login" }),
        contactEmail: z
            .email()
            .meta({ description: "Where to reach the member" }),
        note: z
            .string()
            .max(1000)
            .optional()
            .meta({ description: "What they remember about the old account" }),
    }),
);

export const accountLinkHelpResponseSchema = Schema(
    "AccountLinkHelpResponse",
    z.object({
        success: z.boolean(),
        message: z.string(),
    }),
);
