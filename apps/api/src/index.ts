import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { session } from "./middleware/session";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { env } from "./lib/env";

const app = new Hono();

app.basePath("/api")
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
    .get("/session", session, (c) => {
        const session = c.get("session");
        const user = c.get("user");

        if (!user) return c.body(null, 401);

        return c.json({
            session,
            user,
        });
    });

app.get(
    "/openapi",
    openAPISpecs(app, {
        documentation: {
            info: {
                title: "Hono API",
                version: "1.0.0",
                description: "Greeting API",
            },
            servers: [
                {
                    url: "http://localhost:4000",
                    description: "Local Server",
                },
            ],
        },
    }),
).get(
    "/docs",
    Scalar({
        theme: "saturn",
        url: "/api/openapi",
        sources: [
            { url: "/openapi", title: "API" },
            { url: "/api/auth/open-api/generate-schema", title: "Auth" },
        ],
    }),
);

app.get(
    "/static/*",
    serveStatic({
        root: "./",
    }),
);

if (env.SEED_DB) {
    import("./db/seed").then(({ default: seed }) => seed());
}

serve(
    {
        fetch: app.fetch,
        port: env.PORT,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}/api`);
    },
);

export type AppType = typeof app;
