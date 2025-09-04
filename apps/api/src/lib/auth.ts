import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@photon/db";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    baseURL: process.env.BASE_URL || "http://localhost:4000",
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    advanced: {
        crossSubDomainCookies: {
            enabled: true,
        },
    },
    user: {
        additionalFields: {
            username: {
                type: "string",
                required: true,
                unique: true,
            },
            displayName: {
                type: "string",
                required: false,
            },
            avatar: {
                type: "string",
                required: false,
            },
        },
    },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
