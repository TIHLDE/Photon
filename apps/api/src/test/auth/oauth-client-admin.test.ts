import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Hvem som får administrere OAuth-klienter.
 *
 * Klientendepunktene ligger i @better-auth/oauth-provider, ikke bak vår egen
 * `requireAccess`, og plugin-en spør i utgangspunktet bare om du har en
 * sesjon: enhver innlogget bruker kunne opprette en klient, mens listing og
 * redigering var låst til den som opprettet raden. `oauth-clients:*` kunne
 * dermed gis bort uten å bety noe.
 *
 * Nå eier TIHLDE radene (`clientReference`) og tilgangen avgjør alt
 * (`clientPrivileges`). Testene pinner begge halvdeler: at tilgangen slipper
 * deg til klienter du ikke har laget selv, og at fraværet av den stenger deg
 * ute selv om du er logget inn.
 */

type OAuthClient = { client_id: string; client_name?: string };

async function signInAndGetCookie(
    ctx: IntegrationTestContext,
    user: { email: string; password: string },
) {
    const response = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });

    const cookie = response.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("Invalid cookies returned by auth call");
    return cookie;
}

function createClient(ctx: IntegrationTestContext, cookie: string) {
    return ctx.auth.api.adminCreateOAuthClient({
        headers: new Headers({ Cookie: cookie }),
        body: {
            client_name: "oauth client admin integration test",
            redirect_uris: ["http://127.0.0.1:3000/oauth/callback"],
            token_endpoint_auth_method: "none",
            type: "native",
            grant_types: ["authorization_code"],
            response_types: ["code"],
        },
    }) as Promise<OAuthClient>;
}

describe("OAuth client administration", () => {
    integrationTest(
        "lets a permission holder list and update a client someone else made",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(author, [
                "oauth-clients:create",
            ]);
            const created = await createClient(
                ctx,
                await signInAndGetCookie(ctx, author),
            );

            const other = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(other, [
                "oauth-clients:view",
                "oauth-clients:update",
            ]);
            const cookie = await signInAndGetCookie(ctx, other);
            const headers = new Headers({ Cookie: cookie });

            const listed = await ctx.auth.api.getOAuthClients({ headers });
            expect(listed?.map((c) => c.client_id)).toContain(
                created.client_id,
            );

            const updated = await ctx.auth.api.updateOAuthClient({
                headers,
                body: {
                    client_id: created.client_id,
                    update: { client_name: "renamed by someone else" },
                },
            });
            expect(updated.client_name).toBe("renamed by someone else");
        },
        500_000,
    );

    integrationTest(
        "refuses a signed-in user who holds no oauth-clients permission",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const cookie = await signInAndGetCookie(ctx, user);

            await expect(createClient(ctx, cookie)).rejects.toThrow();
            await expect(
                ctx.auth.api.getOAuthClients({
                    headers: new Headers({ Cookie: cookie }),
                }),
            ).rejects.toThrow();
        },
        500_000,
    );
});
