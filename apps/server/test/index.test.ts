import { expect, test } from "vitest";
import { testWithDB } from "./utils/database.js";
import createApp from "../src/index.js";

test("GET /", async () => {
    const res = await createApp({}).request("/", {
        method: "GET",
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toEqual("Hello world!");
});

testWithDB("Books", async ({ db }) => {
    await db.book.create({
        data: {
            author: "Halla",
            title: "The Great Book",
        },
    });

    const res = await createApp({ db }).request("/book", {
        method: "GET",
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.length).toBe(1);
    expect(body[0].author).toBe("Halla");
});
