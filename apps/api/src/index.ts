import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./lib/auth";
import { session } from "./middleware/session";
import router from "./routes/example";

const app = new Hono();

app.use(
    "/api/auth/**",
    cors({
        origin: "http://localhost:3000",
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
});

app.get("/", (c) => {
    return c.text("Hello Hono!");
});

app.get("/session", session, (c) => {
    const session = c.get("session");
    const user = c.get("user");

    if (!user) return c.body(null, 401);

    return c.json({
        session,
        user,
    });
});

app.route("/", router);

serve(
    {
        fetch: app.fetch,
        port: 4000,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
