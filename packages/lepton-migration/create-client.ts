/**
 * Registrerer Fadderuka som OAuth-klient på Photon.
 * Kjøres én gang: DATABASE_URL=... AUTH_SECRET=... bun create-client.ts
 */
import { createAuth, drizzleAdapter } from "@photon/auth";
import { createDb, schema } from "@photon/db";
import { ConsoleEmailService } from "@photon/core/services/email";
import { InMemoryCache } from "@photon/core/services/cache";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL mangler");

const db = createDb({ connectionString });
const auth = createAuth({
    isDevMode: false,
    secret: process.env.AUTH_SECRET || crypto.randomUUID(),
    services: {
        database: drizzleAdapter(db, { provider: "pg", schema }),
        db,
        cache: new InMemoryCache(),
        email: new ConsoleEmailService(),
    },
    oauth: { pages: { consent: "/oauth/consent", login: "/login" } },
    urls: {
        backend: "https://photon.tihlde.org",
        frontend: "https://tihlde.org",
        additionalTrusted: [],
        basePath: "/api/auth",
    },
    DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: false,
});

const client = await auth.api.adminCreateOAuthClient({
    body: {
        client_name: "Fadderuka",
        redirect_uris: ["https://fadderuka.tihlde.org/api/auth/callback"],
        token_endpoint_auth_method: "client_secret_basic",
        type: "web",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "openid profile email",
        skip_consent: true,
        require_pkce: true,
    },
});

console.log("CLIENT_ID=" + (client as any).client_id);
console.log("CLIENT_SECRET=" + (client as any).client_secret);
process.exit(0);
