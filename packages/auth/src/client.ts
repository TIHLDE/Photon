import { createAuthClient } from "better-auth/react";
import type { AuthInstance } from "./index";
import {
    customSessionClient,
    usernameClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export function createPhotonAuthClient({ baseUrl }: { baseUrl: string }) {
    return createAuthClient({
        baseURL: baseUrl,
        plugins: [
            usernameClient(),
            customSessionClient<AuthInstance>(),
            oauthProviderClient(),
        ],
    });
}
