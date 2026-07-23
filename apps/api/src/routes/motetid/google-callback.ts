import { schema } from "@photon/db";
import { env } from "@photon/core/env";
import { HTTPException } from "hono/http-exception";
import {
    sanitizeReturnTo,
    verifyGoogleState,
} from "~/lib/motetid/google-state";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { googleRedirectUri } from "./google-connect";

export const googleCallbackRoute = route().get(
    "/google/callback",
    describeRoute({
        tags: ["motetid"],
        summary: "Google Calendar OAuth callback",
        operationId: "motetidGoogleCallback",
        description:
            "Handles the redirect back from Google: verifies the signed state, exchanges the code for tokens, stores them, and redirects the browser back to the website.",
    })
        .response({
            statusCode: 302,
            description: "Redirect back to the website",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        if (
            !env.GOOGLE_CLIENT_ID ||
            !env.GOOGLE_CLIENT_SECRET ||
            !env.AUTH_SECRET
        ) {
            throw new HTTPException(501, {
                message: "Google OAuth er ikke konfigurert",
            });
        }

        const code = c.req.query("code");
        const stateParam = c.req.query("state");
        if (!code || !stateParam) {
            throw new HTTPException(400, { message: "Mangler code/state" });
        }

        const payload = verifyGoogleState(stateParam, env.AUTH_SECRET);
        if (!payload || payload.userId !== userId) {
            throw new HTTPException(400, { message: "Ugyldig state" });
        }

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: googleRedirectUri(),
                grant_type: "authorization_code",
            }).toString(),
        });

        if (!tokenRes.ok) {
            throw new HTTPException(400, {
                message: "Kunne ikke utveksle kode til tokens",
            });
        }

        const tokenData = (await tokenRes.json()) as {
            access_token?: string;
            refresh_token?: string;
        };
        if (!tokenData.access_token) {
            throw new HTTPException(400, { message: "Mangler access_token" });
        }

        // Google only returns a refresh token reliably on first consent; keep
        // the stored one when absent.
        await db
            .insert(schema.motetidGoogleCredential)
            .values({
                userId,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token ?? null,
            })
            .onConflictDoUpdate({
                target: schema.motetidGoogleCredential.userId,
                set: {
                    accessToken: tokenData.access_token,
                    ...(tokenData.refresh_token
                        ? { refreshToken: tokenData.refresh_token }
                        : {}),
                },
            });

        const returnTo = sanitizeReturnTo(payload.returnTo);
        return c.redirect(new URL(returnTo, env.WEBSITE_URL).toString(), 302);
    },
);
