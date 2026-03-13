import { createAuthClient } from "better-auth/react";
import type { AuthInstance } from "./index";
import { customSessionClient, genericOAuthClient, usernameClient } from "better-auth/client/plugins";

export function createPhotonAuthClient(url: string) {
  return createAuthClient({
    baseURL: url,
    plugins: [genericOAuthClient(), usernameClient(), customSessionClient<AuthInstance>()],
  });
}
