import crypto from "node:crypto";
import { env } from "@photon/core/env";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { sanitizeReturnTo, signGoogleState } from "~/lib/motetid/google-state";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    googleConnectQuerySchema,
    googleConnectResponseSchema,
} from "./schema";

export function googleRedirectUri(): string {
    return `${env.ROOT_URL.replace(/\/+$/, "")}/api/motetid/google/callback`;
}

export const googleConnectRoute = route().get(
    "/google/connect",
    describeRoute({
        tags: ["motetid"],
        summary: "Start Google Calendar OAuth",
        operationId: "motetidGoogleConnect",
        description:
            "Build a Google OAuth consent URL (calendar.readonly) for the authenticated member. The frontend navigates the browser to the returned URL; Google redirects back to the callback endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: googleConnectResponseSchema,
            description: "Consent URL built",
        })
        .build(),
    requireAuth,
    validator("query", googleConnectQuerySchema),
    async (c) => {
        const userId = c.get("user").id;
        const { returnTo } = c.req.valid("query");

        if (!env.GOOGLE_CLIENT_ID || !env.AUTH_SECRET) {
            throw new HTTPException(501, {
                message: "Google OAuth er ikke konfigurert",
            });
        }

        const state = signGoogleState(
            {
                v: 1,
                userId,
                returnTo: sanitizeReturnTo(returnTo),
                nonce: crypto.randomUUID(),
            },
            env.AUTH_SECRET,
        );

        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
        url.searchParams.set("redirect_uri", googleRedirectUri());
        url.searchParams.set("response_type", "code");
        url.searchParams.set(
            "scope",
            "https://www.googleapis.com/auth/calendar.readonly",
        );
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("state", state);

        return c.json({ url: url.toString() }, 200);
    },
);
