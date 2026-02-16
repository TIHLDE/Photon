// Main entry point — frontend-safe (no server-only code)
export type { AuthDeps } from "./types";
export { createAuthClient, type AuthClient } from "./client";
export type { AuthInstance, Session, User, ExtendedSession } from "./server";
