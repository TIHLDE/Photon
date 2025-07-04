import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { session } from "./middleware/session";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { routes as eventRoutes } from "~/routers/events";

const app = new Hono()
    .basePath("/api")
    .use(
        "/api/auth/**",
        cors({
            origin: "http://localhost:3000",
            allowHeaders: ["Content-Type", "Authorization"],
            allowMethods: ["POST", "GET", "OPTIONS"],
            exposeHeaders: ["Content-Length"],
            maxAge: 600,
            credentials: true,
        }),
    )
    .on(["POST", "GET"], "/api/auth/*", (c) => {
        return auth.handler(c.req.raw);
    })
    .get("/", (c) => {
        return c.text("Hello Hono!");
    })
    .get("/session", session, (c) => {
        const session = c.get("session");
        const user = c.get("user");

        if (!user) return c.body(null, 401);

        return c.json({
            session,
            user,
        });
    })
    .route("/events", eventRoutes);

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
    }),
);

serve(
    {
        fetch: app.fetch,
        port: 4000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
