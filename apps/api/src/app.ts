import { env } from "@photon/core/env";
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
import { type LoggerType, pinoLoggerMiddleware } from "./middleware/logger";
import { globalErrorHandler, notFoundHandler } from "~/lib/errors";
import { emailRoutes } from "~/routes/email";
import { eventRoutes } from "~/routes/event";
import { formRoutes } from "~/routes/form";
import { apiKeyRoutes } from "./routes/api-key";
import { assetRoutes } from "./routes/asset";
import { groupsRoutes } from "./routes/groups";
import { jobRoutes } from "./routes/job";
import { newsRoutes } from "./routes/news";
import { notificationRoutes } from "./routes/notification";
import { userRoutes } from "./routes/user";
import { mcpRoute } from "./test/mcp";

/**
 * Hono context variables type definition.
 * This allows accessing services via c.get('services').
 */
type Variables = {
    ctx: AppContext;
    service: AppServices;
    logger: LoggerType;
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
    }

    const api = new Hono<{ Variables: Variables }>()
        .basePath("/api")
        .on(["POST", "GET"], "/auth/*", (c) => {
            const { auth } = c.get("ctx");
            return auth.handler(c.req.raw);
        })
        .get("/", (c) => {
            return c.text("Healthy!");
        })
        .route("/api-keys", apiKeyRoutes)
        .route("/assets", assetRoutes)
        .route("/email", emailRoutes)
        .route("/event", eventRoutes)
        .route("/forms", formRoutes)
        .route("/notification", notificationRoutes)
        .route("/groups", groupsRoutes)
        .route("/news", newsRoutes)
        .route("/jobs", jobRoutes)
        .route("/user", userRoutes)
        .route("/", mcpRoute);

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
                origin: "http://localhost:3000",
                allowHeaders: ["Content-Type", "Authorization"],
                allowMethods: ["POST", "GET", "OPTIONS"],
                exposeHeaders: ["Content-Length"],
                maxAge: 600,
                credentials: true,
            }),
        )
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

    // Seed DB with default values if necessary
    if (env.SEED_DB) {
        import("./db/seed").then(({ default: seed }) => seed(ctx));
    }

    return app;
};

/**
 * Type of the application, which can be used to get a type-safe client
 */
export type App = Awaited<ReturnType<typeof createApp>>;
