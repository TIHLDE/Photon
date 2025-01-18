import type { Context } from "hono";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { env } from "@/env";
import { and, eq, gt } from "drizzle-orm";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD = 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string) {
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

    const [session] = await db.insert(sessions).values({
        userId,
        expiresAt
    }).returning();

    return session;
}

export function setSessionCookie(c: Context, sessionId: string) {
    setCookie(c, SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/"
    });
}

export function getSessionCookie(c: Context) {
    return getCookie(c, SESSION_COOKIE);
}

export function deleteSessionCookie(c: Context) {
    deleteCookie(c, SESSION_COOKIE);
}

export async function validateAndRenewSession(c: Context) {
    const id = getSessionCookie(c);
    if (!id) return undefined;

    const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())),
        with: {
            user: true
        }
    })
    if (!session) {
        deleteSessionCookie(c);
        return undefined;
    }

    if (session.expiresAt.getTime() - Date.now() < SESSION_RENEWAL_THRESHOLD * 1000) {
        session.expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
        await db.update(sessions).set({
            expiresAt: session.expiresAt
        }).where(eq(sessions.id, id)).execute();
    }

    return session;
}