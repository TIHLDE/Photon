import {
    customSessionClient,
    genericOAuthClient,
    usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
    plugins: [genericOAuthClient(), usernameClient(), customSessionClient()],
});
