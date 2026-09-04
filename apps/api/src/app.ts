import { env } from "@photon/core/env";
import {
    createOAuthOpenIDConfigMetadata,
    createOAuthServerMetadata,
} from "@photon/auth";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import {
    type AppContext,
    type AppServices,
    createAppContext,
    createAppServices,
} from "~/lib/ctx";
import { clearStaleHostOnlySessionCookies } from "~/lib/auth-cookies";
import { globalErrorHandler, notFoundHandler } from "~/lib/errors";
import { emailRoutes } from "~/routes/email";
import { eventRoutes } from "~/routes/event";
import { versionRoutes } from "~/routes/version";
import { formRoutes } from "~/routes/form";
import { pinoLoggerMiddleware } from "./middleware/logger";
import { apiKeyRoutes } from "./routes/api-key";
import { applicationRoutes } from "./routes/application";
import { assetRoutes } from "./routes/asset";
import { bannerRoutes } from "./routes/banner";
import { accountLinkRoutes } from "./routes/account-link";
import { companyRoutes } from "./routes/company";
import { contractsRoutes } from "./routes/contracts";
import { feedbackRoutes } from "./routes/feedback";
import { groupsRoutes } from "./routes/groups";
import { instituteRoutes } from "./routes/institutes";
import { jobRoutes } from "./routes/job";
import { galleryRoutes } from "./routes/gallery";
import { newsRoutes } from "./routes/news";
import { rolesRoutes } from "./routes/roles";
import { toddelRoutes } from "./routes/toddel";
import { notificationRoutes } from "./routes/notification";
import { userRoutes } from "./routes/user";

/**
 * Hono context variables type definition.
 * This allows accessing services via c.get('services').
 */
type Variables = {
    ctx: AppContext;
    service: AppServices;
};

export const createApp = async (variables?: Variables) => {
    // Use or generate app context
    let ctx: AppContext;
    let service: AppServices;
    if (variables) {
        ctx = variables.ctx;
        service = variables.service;
    } else {
        ctx = await createAppContext();
        service = createAppServices(ctx);

        // Setup cron jobs and workers
        const { startBackgroundJobs } = await import("./lib/jobs");
        startBackgroundJobs(ctx);

        // Seed DB with default values if necessary
        if (env.SEED_DB) {
            import("./db/seed").then(({ default: seed }) => seed(ctx));
        }
    }

    const api = new Hono<{ Variables: Variables }>()
        .basePath("/api")
        .on(["POST", "GET"], "/auth/*", async (c) => {
            const { auth } = c.get("ctx");
            // Sign-in and sign-out are also where a session cookie left over
            // from the host-only days gets expired — see
            // {@link clearStaleHostOnlySessionCookies}.
            return clearStaleHostOnlySessionCookies(
                await auth.handler(c.req.raw),
            );
        })
        .get("/", (c) => {
            return c.text("Healthy!");
        })
        .route("/version", versionRoutes)
        .route("/api-keys", apiKeyRoutes)
        .route("/applications", applicationRoutes)
        .route("/assets", assetRoutes)
        .route("/banners", bannerRoutes)
        .route("/account-link", accountLinkRoutes)
        .route("/company", companyRoutes)
        .route("/email", emailRoutes)
        .route("/event", eventRoutes)
        .route("/feedback", feedbackRoutes)
        .route("/forms", formRoutes)
        .route("/galleries", galleryRoutes)
        .route("/notification", notificationRoutes)
        .route("/groups", groupsRoutes)
        .route("/institutes", instituteRoutes)
        .route("/contracts", contractsRoutes)
        .route("/news", newsRoutes)
        .route("/toddel", toddelRoutes)
        .route("/roles", rolesRoutes)
        .route("/jobs", jobRoutes)
        .route("/user", userRoutes);

    const app = new Hono<{ Variables: Variables }>()
        .use(pinoLoggerMiddleware)
        .use("*", async (c, next) => {
            c.set("ctx", ctx);
            c.set("service", service);
            await next();
        })
        .use(
            "*",
            cors({
                // Credentialed requests need an explicit origin — never "*".
                // WEBSITE_ORIGINS is WEBSITE_URL plus the other frontend
                // origins this deployment answers on (see env.ts).
                // Outside production, keep localhost usable even when
                // WEBSITE_URL points somewhere else (an ngrok tunnel, say).
                // Any localhost port is accepted in dev so worktrees/dev
                // servers on non-default ports can talk to the API.
                origin: (origin) => {
                    if (env.WEBSITE_ORIGINS.includes(origin)) return origin;
                    if (
                        env.NODE_ENV !== "production" &&
                        /^http:\/\/localhost(:\d+)?$/.test(origin)
                    ) {
                        return origin;
                    }
                    return undefined;
                },
                allowHeaders: ["Content-Type", "Authorization"],
                allowMethods: [
                    "GET",
                    "POST",
                    "PUT",
                    "PATCH",
                    "DELETE",
                    "OPTIONS",
                ],
                exposeHeaders: ["Content-Length"],
                maxAge: 600,
                credentials: true,
            }),
        )
        .get("/api/auth/.well-known/openid-configuration", (c) => {
            const { auth } = c.get("ctx");
            return createOAuthOpenIDConfigMetadata(auth)(c.req.raw);
        })
        .get("/.well-known/openid-configuration", (c) => {
            const { auth } = c.get("ctx");
            return createOAuthOpenIDConfigMetadata(auth)(c.req.raw);
        })
        .get("/.well-known/oauth-authorization-server/api/auth", (c) => {
            const { auth } = c.get("ctx");
            return createOAuthServerMetadata(auth)(c.req.raw);
        })
        .route("/", api)
        .get(
            "/openapi",
            openAPIRouteHandler(api, {
                documentation: {
                    info: {
                        title: "Photon API",
                        version: "1.0.0",
                        description: "TIHLDEs nye backend",
                    },
                    servers: [
                        {
                            url: "http://localhost:4000",
                            description: "Local Server",
                        },
                        {
                            url: "https://photon.tihlde.org",
                            description: "Production Server",
                        },
                    ],
                },
            }),
        )
        .get(
            "/docs",
            Scalar({
                theme: "saturn",
                url: "/openapi",
                sources: [
                    { url: "/openapi", title: "API" },
                    {
                        url: "/api/auth/open-api/generate-schema",
                        title: "Auth",
                    },
                ],
            }),
        )
        .onError(globalErrorHandler)
        .notFound(notFoundHandler);

    return app;
};

/**
 * Type of the application, which can be used to get a type-safe client
 */
export type App = Awaited<ReturnType<typeof createApp>>;
