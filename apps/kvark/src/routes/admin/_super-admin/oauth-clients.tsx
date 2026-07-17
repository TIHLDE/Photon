import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

import {
    createOAuthClientMutation,
    deleteOAuthClientMutation,
    oauthClientsQuery,
    rotateOAuthClientSecretMutation,
    type CreatedOAuthClient,
    type OAuthClientFull,
} from "#/api/queries/oauth";

type RevealedSecret = { clientId: string; clientSecret: string };

export const Route = createFileRoute("/admin/_super-admin/oauth-clients")({
    component: OAuthClientsPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(oauthClientsQuery);
    },
});

function OAuthClientsPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(
        null,
    );

    const rotate = useMutation(rotateOAuthClientSecretMutation);
    const remove = useMutation(deleteOAuthClientMutation);

    async function handleRotate(client: OAuthClientFull) {
        const result = await rotate.mutateAsync({ clientId: client.client_id });
        setRevealedSecret({
            clientId: result.client_id,
            clientSecret: result.client_secret,
        });
    }

    function handleDelete(client: OAuthClientFull) {
        if (
            window.confirm(
                `Er du sikker på at du vil slette ${
                    client.client_name ?? client.client_id
                }? Alle tilkoblede brukere blir logget ut av appen.`,
            )
        ) {
            remove.mutate({ clientId: client.client_id });
        }
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl">OAuth-klienter</h1>
                    <p className="text-muted-foreground">
                        Registrer tredjepartsapper som logger inn brukere via
                        TIHLDE.
                    </p>
                </div>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                    Ny klient
                </Button>
            </div>

            <Suspense fallback={<TableSkeleton />}>
                <ClientsTable
                    rotatePending={rotate.isPending}
                    removePending={remove.isPending}
                    onRotate={handleRotate}
                    onDelete={handleDelete}
                />
            </Suspense>

            <CreateClientDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(client) =>
                    setRevealedSecret({
                        clientId: client.client_id,
                        clientSecret: client.client_secret ?? "",
                    })
                }
            />

            <SecretRevealDialog
                secret={revealedSecret}
                onClose={() => setRevealedSecret(null)}
            />
        </div>
    );
}

type ClientRowActions = {
    rotatePending: boolean;
    removePending: boolean;
    onRotate: (client: OAuthClientFull) => void;
    onDelete: (client: OAuthClientFull) => void;
};

function ClientsTable(actions: ClientRowActions) {
    const { data: clients } = useSuspenseQuery(oauthClientsQuery);

    if (clients.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Ingen klienter ennå</CardTitle>
                    <CardDescription>
                        Opprett en klient for å la en tredjepartsapp logge inn
                        brukere via TIHLDE.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Navn</TableHead>
                            <TableHead>Client ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Redirect URIs</TableHead>
                            <TableHead className="text-right">
                                Handlinger
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clients.map((client) => (
                            <ClientRow
                                key={client.client_id}
                                client={client}
                                {...actions}
                            />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ClientRow({
    client,
    rotatePending,
    removePending,
    onRotate,
    onDelete,
}: { client: OAuthClientFull } & ClientRowActions) {
    const isPublic = client.token_endpoint_auth_method === "none";
    return (
        <TableRow>
            <TableCell>{client.client_name ?? "—"}</TableCell>
            <TableCell>
                <code>{client.client_id}</code>
            </TableCell>
            <TableCell>{isPublic ? "Public" : "Confidential"}</TableCell>
            <TableCell>
                <ul className="flex flex-col gap-1">
                    {client.redirect_uris.map((uri) => (
                        <li key={uri}>
                            <code className="text-xs">{uri}</code>
                        </li>
                    ))}
                </ul>
            </TableCell>
            <TableCell>
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={rotatePending || isPublic}
                        onClick={() => onRotate(client)}
                    >
                        Roter hemmelighet
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={removePending}
                        onClick={() => onDelete(client)}
                    >
                        Slett
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

function CreateClientDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (client: CreatedOAuthClient) => void;
}) {
    const [clientName, setClientName] = useState("");
    const [redirectUrisRaw, setRedirectUrisRaw] = useState("");
    const [isPublic, setIsPublic] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = useMutation(createOAuthClientMutation);

    function reset() {
        setClientName("");
        setRedirectUrisRaw("");
        setIsPublic(false);
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const redirect_uris = redirectUrisRaw
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (redirect_uris.length === 0) {
            setError("Minst én redirect URI er påkrevd.");
            return;
        }
        try {
            const data = await create.mutateAsync({
                data: {
                    client_name: clientName || undefined,
                    redirect_uris,
                    token_endpoint_auth_method: isPublic
                        ? "none"
                        : "client_secret_basic",
                    type: "web",
                },
            });
            onCreated(data);
            reset();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>Ny OAuth-klient</DialogTitle>
                        <DialogDescription>
                            Klient-hemmeligheten vises kun én gang etter
                            oppretting.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="oauth-client-name">
                                Navn
                            </FieldLabel>
                            <Input
                                id="oauth-client-name"
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="f.eks. TIHLDE Wiki"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="oauth-redirect-uris">
                                Redirect URIs (én per linje)
                            </FieldLabel>
                            <textarea
                                id="oauth-redirect-uris"
                                rows={4}
                                required
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                value={redirectUrisRaw}
                                onChange={(e) =>
                                    setRedirectUrisRaw(e.target.value)
                                }
                                placeholder="https://app.example.com/oauth/callback"
                            />
                        </Field>
                        <Field className="flex-row items-center gap-2">
                            <Checkbox
                                id="oauth-client-public"
                                checked={isPublic}
                                onCheckedChange={(next) =>
                                    setIsPublic(next === true)
                                }
                            />
                            <FieldLabel htmlFor="oauth-client-public">
                                Offentlig klient (PKCE, ingen
                                klient-hemmelighet)
                            </FieldLabel>
                        </Field>
                    </FieldGroup>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={create.isPending}>
                            Opprett
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function SecretRevealDialog({
    secret,
    onClose,
}: {
    secret: RevealedSecret | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={secret !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Klient-hemmelighet</DialogTitle>
                    <DialogDescription>
                        Kopier hemmeligheten nå — du kan ikke se den igjen.
                    </DialogDescription>
                </DialogHeader>
                {secret && (
                    <Card>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Client ID
                                </span>
                                <code className="text-sm">
                                    {secret.clientId}
                                </code>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">
                                    Client Secret
                                </span>
                                <code className="text-sm break-all">
                                    {secret.clientSecret || "(none)"}
                                </code>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(
                                        secret.clientSecret,
                                    );
                                }}
                                disabled={!secret.clientSecret}
                            >
                                Kopier hemmelighet
                            </Button>
                        </CardFooter>
                    </Card>
                )}
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        Lukk
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </CardContent>
        </Card>
    );
}
