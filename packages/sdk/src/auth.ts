import { genericOAuthClient, usernameClient } from "better-auth/client/plugins";

export type { ExtendedSession } from "./generated/session-types";

export interface PhotonAuthOptions {
    /** Defaults to `https://photon.tihlde.org` */
    baseUrl?: string;
}

export function createPhotonAuthOptions(options: PhotonAuthOptions = {}) {
    return {
        baseURL: options.baseUrl ?? "https://photon.tihlde.org",
        plugins: [genericOAuthClient(), usernameClient()],
    };
}
