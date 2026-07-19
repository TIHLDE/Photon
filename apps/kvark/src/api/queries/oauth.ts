import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { clientAuthInstance } from "#/api/auth";

const OAuthQueryKeys = {
    clientList: ["oauth", "clients"] as const,
    client: ["oauth", "client"] as const,
} as const;

// TODO: Found out if this is needed here, or can be moved to the Auth Package
export type OAuthClientPublic = {
    client_id: string;
    client_name?: string | null;
    client_uri?: string | null;
    logo_uri?: string | null;
    contacts?: string[] | null;
    tos_uri?: string | null;
    policy_uri?: string | null;
    scopes?: string[] | null;
};

// TODO: Found out if this is needed here, or can be moved to the Auth Package
export type OAuthClientFull = OAuthClientPublic & {
    redirect_uris: string[];
    post_logout_redirect_uris?: string[] | null;
    grant_types?: string[] | null;
    response_types?: string[] | null;
    token_endpoint_auth_method?: string | null;
    type?: string | null;
    skip_consent?: boolean | null;
    enable_end_session?: boolean | null;
    require_pkce?: boolean | null;
    metadata?: Record<string, unknown> | null;
};

async function unwrap<T>(
    result: { data: unknown; error: { message?: string } | null },
    label: string,
): Promise<T> {
    if (result.error) {
        throw new Error(`${label}: ${result.error.message ?? "ukjent feil"}`);
    }
    return result.data as T;
}

export const oauthClientQuery = (clientId: string) =>
    queryOptions({
        queryKey: [...OAuthQueryKeys.client, clientId],
        queryFn: async () =>
            unwrap<OAuthClientPublic>(
                await clientAuthInstance.oauth2.getClient({
                    query: { client_id: clientId },
                }),
                "Kunne ikke hente OAuth-klient",
            ),
    });

export const oauthClientsQuery = queryOptions({
    queryKey: [...OAuthQueryKeys.clientList],
    // Always refetch on navigation — admins expect the list to reflect changes
    // made in other tabs / by other admins.
    staleTime: 0,
    queryFn: async () =>
        unwrap<OAuthClientFull[]>(
            await clientAuthInstance.oauth2.getClients(),
            "Kunne ikke hente OAuth-klienter",
        ),
});

export type CreateOAuthClientInput = {
    client_name?: string;
    redirect_uris: string[];
    post_logout_redirect_uris?: string[];
    contacts?: string[];
    client_uri?: string;
    logo_uri?: string;
    tos_uri?: string;
    policy_uri?: string;
    token_endpoint_auth_method?:
        | "none"
        | "client_secret_basic"
        | "client_secret_post";
    type?: "web" | "native" | "user-agent-based";
    grant_types?: Array<
        "authorization_code" | "client_credentials" | "refresh_token"
    >;
    response_types?: Array<"code">;
};

export type CreatedOAuthClient = OAuthClientFull & {
    client_secret?: string | null;
    client_secret_expires_at?: number | null;
};

export const createOAuthClientMutation = mutationOptions({
    mutationFn: async ({ data }: { data: CreateOAuthClientInput }) =>
        unwrap<CreatedOAuthClient>(
            await clientAuthInstance.oauth2.createClient(data),
            "Kunne ikke opprette OAuth-klient",
        ),
    onSuccess: (_data, _vars, _ctx, ctx) => {
        ctx.client.invalidateQueries({
            queryKey: [...OAuthQueryKeys.clientList],
        });
    },
});

export type UpdateOAuthClientInput = Omit<CreateOAuthClientInput, "type"> & {
    type?: CreateOAuthClientInput["type"];
};

export const updateOAuthClientMutation = mutationOptions({
    mutationFn: async ({
        clientId,
        update,
    }: {
        clientId: string;
        update: UpdateOAuthClientInput;
    }) =>
        unwrap<OAuthClientFull>(
            await clientAuthInstance.oauth2.updateClient({
                client_id: clientId,
                update,
            }),
            "Kunne ikke oppdatere OAuth-klient",
        ),
    onSuccess: (_data, vars, _ctx, ctx) => {
        ctx.client.invalidateQueries({
            queryKey: [...OAuthQueryKeys.clientList],
        });
        ctx.client.invalidateQueries({
            queryKey: [...OAuthQueryKeys.client, vars.clientId],
        });
    },
});

export const deleteOAuthClientMutation = mutationOptions({
    mutationFn: async ({ clientId }: { clientId: string }) =>
        unwrap<void>(
            await clientAuthInstance.oauth2.deleteClient({
                client_id: clientId,
            }),
            "Kunne ikke slette OAuth-klient",
        ),
    onSuccess: (_data, _vars, _ctx, ctx) => {
        ctx.client.invalidateQueries({
            queryKey: [...OAuthQueryKeys.clientList],
        });
    },
});

export type OAuthConsentResult = { url?: string | null } | null;

export const oauthConsentMutation = mutationOptions({
    mutationFn: async ({
        accept,
        scope,
    }: {
        accept: boolean;
        scope?: string;
    }) =>
        unwrap<OAuthConsentResult>(
            await clientAuthInstance.oauth2.consent({
                accept,
                ...(accept && scope ? { scope } : {}),
            }),
            "Kunne ikke fullføre godkjenning",
        ),
});

export const rotateOAuthClientSecretMutation = mutationOptions({
    mutationFn: async ({ clientId }: { clientId: string }) =>
        unwrap<{ client_id: string; client_secret: string }>(
            await clientAuthInstance.oauth2.client.rotateSecret({
                client_id: clientId,
            }),
            "Kunne ikke rotere klient-hemmelighet",
        ),
    onSuccess: (_data, vars, _ctx, ctx) => {
        ctx.client.invalidateQueries({
            queryKey: [...OAuthQueryKeys.client, vars.clientId],
        });
    },
});
