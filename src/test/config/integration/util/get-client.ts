import { testClient } from "hono/testing";
import type { TestUtilContext } from ".";

export const createGetClient =
    (ctx: TestUtilContext) => (headers?: Record<string, string>) => {
        return testClient(ctx.app, undefined, undefined, {
            headers,
        });
    };
