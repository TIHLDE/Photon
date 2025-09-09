import { Hono } from "hono";

export const paymentWebhookRoute = new Hono();

paymentWebhookRoute.post("/payments/webhook", async (c) => {
    return c.body(null, 204);
});
