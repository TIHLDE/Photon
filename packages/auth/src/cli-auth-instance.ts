import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuth } from ".";

export default createAuth({
    DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: true,
    isDevMode: true,
    oauth: {
        pages: {
            consent: "/consent",
            login: "/login",
        },
    },
    secret: "cli-secret",
    // @ts-expect-error the rest of the services isn't needed when generating dbSchema
    services: {
        database: drizzleAdapter(
            // @ts-expect-error The db instance is not needed either, just the configuration
            undefined,
            { provider: "pg" },
        ),
    },
    urls: {
        frontend: "no-frontend",
        backend: "no-backend",
        additionalTrusted: [],
        basePath: "/api/auth",
    },
});
