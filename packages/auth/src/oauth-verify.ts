import { jwtVerify, createLocalJWKSet } from "jose";
import type { JWTPayload } from "better-auth";
import type { AuthInstance } from "./index";
import { z } from "zod";

export type VerifiedAccessToken = {
    sub: string;
    clientId: string;
    scopes: string[];
    sessionId?: string;
    payload: JWTPayload;
};

const accessTokenPayloadSchema = z
    .object({
        sub: z.string(),
        client_id: z.string().optional(),
        azp: z.string().optional(),
        scope: z.string().optional().default(""),
        sid: z.string(),
    })
    .transform(({ client_id, azp, sid, scope, ...payload }) => ({
        ...payload,
        clientId: client_id ?? azp ?? "",
        scopes: scope.split(/\s+/).filter(Boolean),
        sessionId: sid,
    }));

export async function verifyJWTAccessToken(
    auth: AuthInstance,
    token: string | undefined,
): Promise<VerifiedAccessToken | null> {
    if (!token) return null;
    if (token.split(".").length !== 3) return null;

    try {
        const jwks = await auth.api.getJwks();
        const jwksSet = createLocalJWKSet(jwks);

        const { payload } = await jwtVerify(token, jwksSet);

        const schema = accessTokenPayloadSchema.safeParse(payload);
        if (!schema.success) return null;

        return {
            ...schema.data,
            payload,
        };
    } catch {
        return null;
    }
}
