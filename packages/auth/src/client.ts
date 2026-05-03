import { createAuthClient } from "better-auth/react";
import type { AuthInstance } from "./index";
import {
    customSessionClient,
    genericOAuthClient,
    usernameClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export function createPhotonAuthClient({ baseUrl }: { baseUrl: string }) {
    return createAuthClient({
        baseURL: baseUrl,
        plugins: [
            genericOAuthClient(),
            usernameClient(),
            customSessionClient<AuthInstance>(),
            oauthProviderClient(),
        ],
    });
}
