import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";
import { jsonContent, StatusCodes } from "@/lib/http";
import { auth } from "@/middlewares/auth";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { sessions, users } from "@/db/schema";
import { compare, hash } from "bcrypt";
import { createSession, deleteSessionCookie, setSessionCookie } from "@/lib/session";

const router = new Hono()

const registerSchema = z.object({
    username: z.string(),
    email: z.string().email(),
    password: z.string(),
})

const registerResponseSchema = z.object({
    message: z.string(),
})

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

const loginResponseSchema = z.object({
    message: z.string(),
})

const logoutResponseSchema = z.object({
    message: z.string(),
})

router
    .post("/register", describeRoute({
        description: "Register a new user",
        responses: {
            [StatusCodes.OK]: jsonContent(registerResponseSchema, "User registered successfully"),
        },
        tags: ["auth"]
    }), validator("json", registerSchema), async (c) => {
        const { username, email, password } = c.req.valid("json")

        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email)
        })
        if (existingUser) return c.json({ message: "User already exists" })

        const passwordHash = await hash(password, 10)

        await db.insert(users).values({
            username,
            email,
            passwordHash
        })

        return c.json({
            message: "User registered successfully",
        })
    })
    .post("/login", describeRoute({
        description: "Login an existing user",
        responses: {
            [StatusCodes.OK]: jsonContent(loginResponseSchema, "User logged in successfully"),
        },
        tags: ["auth"]
    }), validator("json", loginSchema), async (c) => {
        const { email, password } = c.req.valid("json")

        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        })

        if (!user) return c.json({ message: "Invalid email or password" })

        const passwordMatch = await compare(password, user.passwordHash)

        if (!passwordMatch) return c.json({ message: "Invalid email or password" })

        const session = await createSession(user.id)
        setSessionCookie(c, session.id)

        return c.json({
            message: "User logged in successfully",
        })
    })
    .delete("/logout", describeRoute({
        description: "Logout the current user",
        responses: {
            [StatusCodes.OK]: jsonContent(logoutResponseSchema, "User logged out successfully"),
        },
        tags: ["auth"]
    }), auth, async (c) => {
        const session = c.get("session")

        if (!session) {
            return c.json({
                message: "No user is currently logged in",
            })
        }

        await db.delete(sessions).where(eq(sessions.id, session.id))
        deleteSessionCookie(c)

        return c.json({
            message: `User ${session.userId} logged out successfully`,
        })
    })

export default router