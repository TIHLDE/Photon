import { customSessionClient, genericOAuthClient, usernameClient } from "better-auth/client/plugins";
import type { AuthInstance } from "@photon/auth";

export function getPhotonBetterAuthPlugins() {
  return [genericOAuthClient(), usernameClient(), customSessionClient<AuthInstance>()];
}
