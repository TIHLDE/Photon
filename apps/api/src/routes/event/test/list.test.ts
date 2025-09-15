import { testClient } from "hono/testing";
import { expect, it, describe } from "vitest";
import { app } from "~/index";

describe("list events", () => {
    const client = testClient(app);

    it("gets a list of events", async () => {
        const res = await client.api.event.$get({
            query: {},
        });

        expect(res.status).toBe(200);
        expect(Array.isArray((await res.json()).items)).toBe(true);
    });
});
