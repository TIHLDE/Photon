import { Hono } from "hono";

export const paymentsWebhookRouter = new Hono();

paymentsWebhookRouter.post("/payments/webhook", async (c) => {
    return c.body(null, 204);
});
