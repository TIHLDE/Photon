import { extendZodWithOpenApi } from 'zod-openapi'
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";
import { jsonContent, StatusCodes } from "@/lib/http";
import { db } from "@/db";
import { and, eq, gt } from "drizzle-orm";
import { passwordResets, users } from "@/db/schema";
import { generateToken } from "@/lib/crypto";
import { hash } from 'bcrypt';

extendZodWithOpenApi(z)

const router = new Hono()

const requestSchema = z.object({
    email: z.string().email().openapi({
        description: "The email address to request a password reset for",
        example: "ola.normann@stud.ntnu.no"
    }),
})

const requestResponseSchema = z.object({
    messsage: z.string(),
})

const confirmSchema = z.object({
    token: z.string(),
    password: z.string(),
})

const confirmResponseSchema = z.object({
    message: z.string(),
})

router
    .post("/request", describeRoute({
        description: "Request a password reset",
        responses: {
            [StatusCodes.OK]: jsonContent(requestResponseSchema, "Password reset requested"),
        },
        tags: ["auth"]
    }), validator("json", requestSchema), async (c) => {
        const { email } = c.req.valid("json")

        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        })

        if (!user) {
            return c.json({ message: "Password reset requested" })
        }

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

        await db.insert(passwordResets).values({
            email,
            token,
            expiresAt
        })

        // TODO: Add email sending (resend?)

        return c.json({ message: "Password reset requested" })
    })
    .post("/confirm", describeRoute({
        description: "Confirm a password reset",
        responses: {
            [StatusCodes.OK]: jsonContent(confirmResponseSchema, "Password reset confirmed"),
        },
        tags: ["auth"]
    }), validator("json", confirmSchema), async (c) => {
        const { token, password } = c.req.valid("json")

        const reset = await db.query.passwordResets.findFirst({
            where: and(eq(passwordResets.token, token), gt(passwordResets.expiresAt, new Date()))
        })

        if (!reset) {
            return c.json({ message: "Invalid token" }, StatusCodes.BAD_REQUEST)
        }

        const user = await db.query.users.findFirst({
            where: eq(users.email, reset.email)
        })

        if (!user) {
            await db.delete(passwordResets).where(eq(passwordResets.token, token))
            return c.json({ message: "Invalid token" }, StatusCodes.BAD_REQUEST)
        }

        const passwordHash = await hash(password, 10)

        await db.update(users).set({
            passwordHash
        }).where(eq(users.id, user.id))

        await db.delete(passwordResets).where(eq(passwordResets.token, token))

        return c.json({ message: "Password reset confirmed" })
    })

export default router