import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { auth } from "~/lib/auth";
import { env } from "~/lib/env";
import { eventRoutes } from "~/routes/event";
import { setupWebhooks } from "./lib/vipps";

export const app = new Hono()
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
