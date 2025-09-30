import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import { auth } from "~/lib/auth";
import { type AppContext, createAppContext } from "~/lib/context";
import { env } from "~/lib/env";
import { eventRoutes } from "~/routes/event";
import { setupWebhooks } from "./lib/vipps";

/**
 * Hono context variables type definition.
 * This allows accessing services via c.get('services').
 */
type Variables = {
    services: AppContext;
};

export const app = new Hono<{ Variables: Variables }>()
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
        return auth.handler(c.req.raw);
    })
    .get("/", (c) => {
        return c.text("Healthy!");
    })
    .route("/event", eventRoutes);

const server = new Hono();
server.route("/", app);

app.get(
    "/static/*",
    serveStatic({
        root: "./",
    }),
);

server
    .get(
        "/openapi",
        openAPIRouteHandler(app, {
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
                { url: "/api/auth/open-api/generate-schema", title: "Auth" },
            ],
        }),
    );

// Initialize application context with real service instances
const appContext = await createAppContext({
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
});

// Inject services into all requests via middleware
app.use("*", async (c, next) => {
    c.set("services", appContext);
    await next();
});

if (env.SEED_DB) {
    import("./db/seed").then(({ default: seed }) => seed());
}

await setupWebhooks();

serve(
    {
        fetch: server.fetch,
        port: env.PORT,
    },
    (info) => {
        console.log(
            `📦 Server is running on http://localhost:${info.port}/api`,
        );
    },
);
