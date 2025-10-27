import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { type AppContext, createAppContext } from "~/lib/ctx";
import { env } from "~/lib/env";
import { emailRoutes } from "~/routes/email";
import { eventRoutes } from "~/routes/event";
import { setupWebhooks } from "./lib/vipps";
import { mcpRoute } from "./test/mcp";

/**
 * Hono context variables type definition.
 * This allows accessing services via c.get('services').
 */
type Variables = {
    ctx: AppContext;
};

export const createApp = async (variables?: Variables) => {
    // Use or generate app context
    let ctx: AppContext;
    if (variables) {
        ctx = variables.ctx;
    } else {
        ctx = await createAppContext();

        // Setup cron jobs and workers
        const { startBackgroundJobs } = await import("./lib/jobs");
        startBackgroundJobs(ctx);
    }

    const api = new Hono<{ Variables: Variables }>()
        .basePath("/api")
        .use(
            "/auth/**",
            cors({
                origin: "http://localhost:3000",
                allowHeaders: ["Content-Type", "Authorization"],
                allowMethods: ["POST", "GET", "OPTIONS"],
                exposeHeaders: ["Content-Length"],
                maxAge: 600,
                credentials: true,
            }),
        )
        .on(["POST", "GET"], "/auth/*", (c) => {
            const { auth } = c.get("ctx");
            return auth.handler(c.req.raw);
        })
        .get("/", (c) => {
            return c.text("Healthy!");
        })
        .route("/email", emailRoutes)
        .route("/event", eventRoutes)
        .route("/", mcpRoute);

    const app = new Hono<{ Variables: Variables }>()
        .use(logger())
        .use("*", async (c, next) => {
            c.set("ctx", ctx);
            await next();
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
        .get(
            "/static/*",
            serveStatic({
                root: "./",
            }),
        );

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

if (env.NODE_ENV !== "test") {
    await setupWebhooks();

    const app = await createApp();

    serve(
        {
            fetch: app.fetch,
            port: env.PORT,
        },
        (info) => {
            console.log(
                `📦 Server is running on http://localhost:${info.port}/api`,
            );
            console.log(
                `📋 Documentation is running on http://localhost:${info.port}/docs`,
            );
        },
    );
}
