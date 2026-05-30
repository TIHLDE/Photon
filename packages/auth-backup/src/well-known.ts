import {
    oauthProviderAuthServerMetadata,
    oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import type { AuthInstance } from "./index";

const discoveryHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
} satisfies Record<string, string>;

export const createOAuthAuthorizationServerMetadataHandler = (
    auth: AuthInstance,
) =>
    oauthProviderAuthServerMetadata(auth, {
        headers: discoveryHeaders,
    });

export const createOpenIdConfigurationMetadataHandler = (auth: AuthInstance) =>
    oauthProviderOpenIdConfigMetadata(auth, {
        headers: discoveryHeaders,
    });
