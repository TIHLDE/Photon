import { Hono } from "hono";
import { WorkerMailer } from "worker-mailer";

type Bindings = {
    EMAIL_PROXY_KEY: string;
    MAIL_HOST: string;
    MAIL_PORT: string;
    MAIL_USER: string;
    MAIL_PASS: string;
    MAIL_FROM: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
    return c.json({ status: "ok" });
});

app.post("/send", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return c.json({ error: "Missing authorization" }, 401);
    }

    const token = authHeader.slice(7);
    if (token !== c.env.EMAIL_PROXY_KEY) {
        return c.json({ error: "Invalid authorization" }, 401);
    }

    const body = await c.req.json<{
        to: string;
        subject: string;
        html: string;
    }>();

    if (!body.to || !body.subject || !body.html) {
        return c.json(
            { error: "Missing required fields: to, subject, html" },
            400,
        );
    }

    const port = Number.parseInt(c.env.MAIL_PORT || "465");

    await WorkerMailer.send(
        {
            host: c.env.MAIL_HOST,
            port,
            secure: port === 465,
            startTls: port === 587,
            credentials: {
                username: c.env.MAIL_USER,
                password: c.env.MAIL_PASS,
            },
            authType: "plain",
        },
        {
            from: { name: "TIHLDE", email: c.env.MAIL_FROM },
            to: body.to,
            subject: body.subject,
            html: body.html,
        },
    );

    return c.json({ success: true });
});

export default app;
