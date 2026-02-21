import { Hono } from "hono";
import type { AppContext, AppServices } from "./ctx";
import { LoggerType } from "~/middleware/logger";

type Variables = {
    ctx: AppContext;
    service: AppServices;
    logger: LoggerType;
};

/**
 * Creates an API route (Hono instance)
 *
 * Adds type safety to common services such as db.
 * Use `c.get("ctx")` to access them
 */
export const route = () => {
    return new Hono<{ Variables: Variables }>();
};
