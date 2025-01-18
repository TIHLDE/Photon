import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { jsonContent, StatusCodes } from "@/lib/http";

// TODO:
// - Implement the OAuth2 Authorization Code Flow
// should be external -> /authorize -> /login (web) -> /consent (web) -> /callback -> external -> /token -> external

const router = new Hono()

const authorizeSchema = z.object({
    response_type: z.string(),
    client_id: z.string(),
    redirect_uri: z.string(),
    scope: z.string(),
    state: z.string(),
    code_challenge: z.string(),
    code_challenge_method: z.string(),
})

const authorizeResponseSchema = z.object({})

const callbackSchema = z.object({

})

const callbackResponseSchema = z.object({})

const authorizationCodeSchema = z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string(),
    redirect_uri: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    code_verifier: z.string(),
})

const refreshTokenSchema = z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
})

const tokenSchema = z.union([authorizationCodeSchema, refreshTokenSchema])

const authorizationCodeResponseSchema = z.object({})

const refreshTokenResponseSchema = z.object({})

const tokenResponseSchema = z.union([authorizationCodeResponseSchema, refreshTokenResponseSchema])

router
    .get("/authorize", describeRoute({
        description: "Authorize an OAuth2 client",
        responses: {
            [StatusCodes.OK]: jsonContent(authorizeResponseSchema, "Redirected to consent page"),
        },
        tags: ["oauth"]
    }))
    .get("/callback", describeRoute({
        description: "OAuth2 consent callback",
        responses: {
            [StatusCodes.OK]: jsonContent(callbackResponseSchema, "OAuth2 client authorized"),
        },
        tags: ["oauth"]
    }))
    .post("/token", describeRoute({
        description: "OAuth2 token endpoint",
        responses: {
            [StatusCodes.OK]: jsonContent(tokenResponseSchema, "Token issued"),
        },
        tags: ["oauth"]
    }))
    .get("/userinfo")
    .get(".well-known/openid-configuration")


export default router