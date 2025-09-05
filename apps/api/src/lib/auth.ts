import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@photon/db";
import { genericOAuth } from "better-auth/plugins"

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
    plugins: [
        genericOAuth({
            config: [
                {
                    providerId: "feide",
                    clientId: process.env.FEIDE_CLIENT_ID,
                    clientSecret: process.env.FEIDE_CLIENT_SECRET,
                    discoveryUrl: "https://auth.dataporten.no/.well-known/openid-configuration",
                    getUserInfo: async (tokens) => { }
                },
            ]
        })
    ]
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
