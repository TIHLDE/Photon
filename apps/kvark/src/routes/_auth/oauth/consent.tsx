import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { z } from "zod";

import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

import { authClientWithRedirect } from "#/api/auth";
import {
    oauthClientQuery,
    oauthConsentMutation,
    type OAuthClientPublic,
} from "#/api/queries/oauth";

const searchSchema = z.object({
    client_id: z.string(),
    scope: z.string().optional(),
});

export const Route = createFileRoute("/_auth/oauth/consent")({
    validateSearch: searchSchema,
    beforeLoad: async ({ location }) => {
        const auth = await authClientWithRedirect(location.href);
        return { auth };
    },
    loaderDeps: ({ search }) => ({
        clientId: search.client_id,
    }),
    loader: async ({ context, deps }) => {
        await context.queryClient.ensureQueryData(
            oauthClientQuery(deps.clientId),
        );
    },
    component: ConsentPage,
});

const SCOPE_DESCRIPTIONS: Record<string, string> = {
    openid: "Identifisere deg via TIHLDE-kontoen din",
    profile: "Lese profilinformasjon (navn, brukernavn, bilde)",
    email: "Lese e-postadressen din",
    offline_access: "Holde deg innlogget i bakgrunnen",
    groups: "Se hvilke grupper du er medlem av",
    roles: "Se rollene og rettighetene dine i TIHLDE",
};

function ConsentPage() {
    const { client_id, scope } = Route.useSearch();
    const requestedScopes = scope?.trim()
        ? scope.split(/\s+/).filter(Boolean)
        : [];

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <Suspense fallback={<ConsentSkeleton />}>
                    <ConsentCard
                        clientId={client_id}
                        requestedScopes={requestedScopes}
                    />
                </Suspense>
            </div>
        </div>
    );
}

function ConsentCard({
    clientId,
    requestedScopes,
}: {
    clientId: string;
    requestedScopes: string[];
}) {
    const { data: client } = useSuspenseQuery(oauthClientQuery(clientId));

    const decision = useMutation({
        ...oauthConsentMutation,
        onSuccess: (data) => {
            if (data?.url) {
                window.location.href = data.url;
            }
        },
    });

    const scope = requestedScopes.join(" ") || undefined;
    const scopesToShow =
        requestedScopes.length > 0 ? requestedScopes : (client.scopes ?? []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{getClientDisplayName(client)}</CardTitle>
                <CardDescription>
                    ber om tilgang til TIHLDE-kontoen din.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-3">
                    <p className="text-sm">Applikasjonen ber om tilgang til:</p>
                    <ul className="flex flex-col gap-2">
                        {scopesToShow.map((s) => (
                            <li
                                key={s}
                                className="flex items-start gap-2 text-sm"
                            >
                                <span aria-hidden>•</span>
                                <span>{SCOPE_DESCRIPTIONS[s] ?? s}</span>
                            </li>
                        ))}
                    </ul>
                    {decision.isError && (
                        <p className="text-sm text-destructive" role="alert">
                            {decision.error.message}
                        </p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                <Button
                    type="button"
                    className="w-full"
                    disabled={decision.isPending}
                    onClick={() => decision.mutate({ accept: true, scope })}
                >
                    Godkjenn
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={decision.isPending}
                    onClick={() => decision.mutate({ accept: false })}
                >
                    Avslå
                </Button>
            </CardFooter>
        </Card>
    );
}

function ConsentSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </CardFooter>
        </Card>
    );
}

function getClientDisplayName(client: OAuthClientPublic): string {
    return client.client_name ?? client.client_id;
}
