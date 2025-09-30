import { Hono } from "hono";
import type { AppContext } from "./context";

type Variables = {
    services: AppContext;
};

/**
 * Creates an API route (Hono instance)
 *
 * Adds type safety to common services such as db.
 * Use `c.get("services")` to access them
 */
export const route = () => {
    return new Hono<{ Variables: Variables }>();
};
