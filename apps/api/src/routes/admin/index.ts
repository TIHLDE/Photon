import { route } from "~/lib/route";
import { updateUserEmailRoute } from "./users/email";

/**
 * Routes that change another member's authentication data — the address they
 * sign in with, and anything else Better Auth's own endpoints only let a
 * member change for themselves.
 *
 * They live under `/api/admin` so their purpose is obvious from the path, and
 * every one of them requires `root`. Members changing their *own* credentials
 * go through Better Auth (`/api/auth/*`), never through a route of ours.
 */
export const adminRoutes = route().route("/users", updateUserEmailRoute);
