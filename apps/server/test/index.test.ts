import { test, expect, describe, beforeAll } from "vitest";
import app from "../src/index.js";

test("GET /", async () => {
    const res = await app.request("/", {
        method: "GET",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toEqual("Hello world!");
});
