import { serve } from "@hono/node-server";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import { type AppContext, createAppContext } from "~/lib/ctx";
import { env } from "~/lib/env";
import { eventRoutes } from "~/routes/event";
import { setupWebhooks } from "./lib/vipps";

/**
 * Hono context variables type definition.
 * This allows accessing services via c.get('services').
 */
type Variables = {
    ctx: AppContext;
};

export const createApp = async (variables?: Variables) => {
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
        .route("/event", eventRoutes);

    // Use or generate app context
    let ctx: AppContext;
    if (variables) {
        ctx = variables.ctx;
    } else {
        ctx = await createAppContext();
    }

    // Inject app context into all endpoints
    api.use("*", async (c, next) => {
        c.set("ctx", ctx);
        await next();
    });

    const app = new Hono()
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
        );

    return app;
};

const app = await createApp();

/**
 * Type of the application, which can be used to get a type-safe client
 */
export type App = typeof app;

// Seed DB with default values if necessary
if (env.SEED_DB) {
    import("./db/seed").then(({ default: seed }) => seed());
}

await setupWebhooks();

serve(
    {
        fetch: app.fetch,
        port: env.PORT,
    },
    (info) => {
        console.log(
            `📦 Server is running on http://localhost:${info.port}/api`,
        );
    },
);
