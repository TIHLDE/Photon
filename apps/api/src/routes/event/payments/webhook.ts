import { Hono } from "hono";

export const paymentWebhookRoute = new Hono().post(
    "/payments/webhook",
    async (c) => {
        return c.body(null, 204);
    },
);
