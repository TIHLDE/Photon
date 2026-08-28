import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
    KeyIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    Trash2,
} from "lucide-react";
import { Suspense, useState } from "react";

import type { ApiKey } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardFooter } from "@tihlde/ui/ui/card";
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
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { Textarea } from "@tihlde/ui/ui/textarea";

import {
    createApiKeyMutation,
    deleteApiKeyMutation,
    getApiKeysQuery,
    regenerateApiKeyMutation,
    updateApiKeyMutation,
} from "#/api/queries/api-keys";
import { Stagger } from "@tihlde/ui/ui/motion";

import {
    ConfirmDeleteDialog,
    usePendingConfirm,
} from "#/components/confirm-delete-dialog";
import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";
import { formatOsloDate } from "#/lib/date";

export const Route = createFileRoute("/admin/_super-admin/api-keys")({
    component: ApiKeysPage,
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData(getApiKeysQuery(0));
        return { breadcrumbs: "API Nøkler" };
    },
});

function ApiKeysPage() {
    const [createOpen, setCreateOpen] = useState(false);
    const [editKey, setEditKey] = useState<ApiKey | null>(null);
    const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="API Nøkler"
                description="Nøkler gir tjenester programmatisk tilgang til API-et. Hemmeligheten vises kun én gang."
                action={
                    <Button onClick={() => setCreateOpen(true)}>
                        <PlusIcon className="size-4" />
                        Ny nøkkel
                    </Button>
                }
            />

            <Suspense fallback={<TableSkeleton />}>
                <ApiKeysTable
                    onEdit={setEditKey}
                    onRevealSecret={setRevealedSecret}
                />
            </Suspense>

            <CreateApiKeyDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(secret) => setRevealedSecret(secret)}
            />

            <EditApiKeyDialog
                apiKey={editKey}
                onOpenChange={(open) => {
                    if (!open) setEditKey(null);
                }}
            />

            <SecretRevealDialog
                secret={revealedSecret}
                onClose={() => setRevealedSecret(null)}
            />
        </Stagger>
    );
}

function ApiKeysTable({
    onEdit,
    onRevealSecret,
}: {
    onEdit: (apiKey: ApiKey) => void;
    onRevealSecret: (secret: string) => void;
}) {
    const { data: apiKeys } = useSuspenseQuery(getApiKeysQuery(0));
    const regenerate = useMutation(regenerateApiKeyMutation);
    const remove = useMutation(deleteApiKeyMutation);
    const confirmRotate = usePendingConfirm<ApiKey>();
    const confirmDelete = usePendingConfirm<ApiKey>();

    if (apiKeys.length === 0) {
        return (
            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={KeyIcon}
                        title="Ingen API-nøkler"
                        description="Opprett en nøkkel for å gi en tjeneste tilgang til API-et."
                    />
                </CardContent>
            </Card>
        );
    }

    async function handleRegenerate(apiKey: ApiKey) {
        const result = await regenerate.mutateAsync({ apiKeyId: apiKey.id });
        onRevealSecret(result.key);
    }

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Navn</TableHead>
                                <TableHead>Prefiks</TableHead>
                                <TableHead>Tilganger</TableHead>
                                <TableHead>Sist brukt</TableHead>
                                <TableHead className="text-right">
                                    Handlinger
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {apiKeys.map((apiKey) => (
                                <TableRow key={apiKey.id}>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span>{apiKey.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {apiKey.description}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <code className="text-xs">
                                            {apiKey.keyPrefix}…
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {apiKey.permissions.length === 0 ? (
                                                <span className="text-xs text-muted-foreground">
                                                    Ingen
                                                </span>
                                            ) : (
                                                apiKey.permissions.map(
                                                    (permission) => (
                                                        <Badge
                                                            key={permission}
                                                            variant="secondary"
                                                        >
                                                            {permission}
                                                        </Badge>
                                                    ),
                                                )
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {apiKey.lastUsedAt
                                            ? formatOsloDate(apiKey.lastUsedAt)
                                            : "Aldri"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onEdit(apiKey)}
                                            >
                                                <PencilIcon className="size-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={regenerate.isPending}
                                                onClick={() =>
                                                    confirmRotate.request(
                                                        apiKey,
                                                    )
                                                }
                                            >
                                                <RefreshCwIcon className="size-4" />
                                                Roter
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={remove.isPending}
                                                onClick={() =>
                                                    confirmDelete.request(
                                                        apiKey,
                                                    )
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Rotering sletter ingenting, men den gamle nøkkelen dør i samme
            øyeblikk — samme «dette kan ikke angres»-bekreftelse som sletting. */}
            <ConfirmDeleteDialog
                open={confirmRotate.open}
                onOpenChange={(open) => !open && confirmRotate.clear()}
                title={`Rotere nøkkelen «${confirmRotate.shown?.name}»?`}
                description="Den gamle nøkkelen slutter å virke umiddelbart, og alt som bruker den mister tilgangen til API-et."
                confirmLabel="Roter nøkkel"
                isPending={regenerate.isPending}
                onConfirm={() => {
                    if (!confirmRotate.pending) return;
                    void handleRegenerate(confirmRotate.pending);
                    confirmRotate.clear();
                }}
            />

            <ConfirmDeleteDialog
                open={confirmDelete.open}
                onOpenChange={(open) => !open && confirmDelete.clear()}
                title={`Slette nøkkelen «${confirmDelete.shown?.name}»?`}
                description="Alt som bruker nøkkelen mister tilgangen til API-et. Dette kan ikke angres."
                confirmLabel="Slett nøkkel"
                isPending={remove.isPending}
                onConfirm={() => {
                    if (!confirmDelete.pending) return;
                    remove.mutate({ apiKeyId: confirmDelete.pending.id });
                    confirmDelete.clear();
                }}
            />
        </>
    );
}

function CreateApiKeyDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (secret: string) => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissionsRaw, setPermissionsRaw] = useState("");
    const [error, setError] = useState<string | null>(null);

    const create = useMutation(createApiKeyMutation);

    function reset() {
        setName("");
        setDescription("");
        setPermissionsRaw("");
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        const permissions = parsePermissions(permissionsRaw);
        if (permissions.length === 0) {
            setError("Minst én tilgang er påkrevd.");
            return;
        }
        try {
            const result = await create.mutateAsync({
                data: { name, description, permissions },
            });
            onCreated(result.key);
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
                        <DialogTitle>Ny API-nøkkel</DialogTitle>
                        <DialogDescription>
                            Nøkkelen vises kun én gang etter oppretting.
                        </DialogDescription>
                    </DialogHeader>
                    <ApiKeyFields
                        name={name}
                        description={description}
                        permissionsRaw={permissionsRaw}
                        onNameChange={setName}
                        onDescriptionChange={setDescription}
                        onPermissionsChange={setPermissionsRaw}
                    />
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

function EditApiKeyDialog({
    apiKey,
    onOpenChange,
}: {
    apiKey: ApiKey | null;
    onOpenChange: (open: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [permissionsRaw, setPermissionsRaw] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);

    const update = useMutation(updateApiKeyMutation);

    // Sync local form state whenever a different key is opened for editing.
    if (apiKey && apiKey.id !== loadedId) {
        setLoadedId(apiKey.id);
        setName(apiKey.name);
        setDescription(apiKey.description);
        setPermissionsRaw(apiKey.permissions.join("\n"));
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!apiKey) return;
        setError(null);
        const permissions = parsePermissions(permissionsRaw);
        if (permissions.length === 0) {
            setError("Minst én tilgang er påkrevd.");
            return;
        }
        try {
            await update.mutateAsync({
                apiKeyId: apiKey.id,
                data: { name, description, permissions },
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <Dialog
            open={apiKey !== null}
            onOpenChange={(next) => {
                if (!next) setLoadedId(null);
                onOpenChange(next);
            }}
        >
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>Rediger API-nøkkel</DialogTitle>
                    </DialogHeader>
                    <ApiKeyFields
                        name={name}
                        description={description}
                        permissionsRaw={permissionsRaw}
                        onNameChange={setName}
                        onDescriptionChange={setDescription}
                        onPermissionsChange={setPermissionsRaw}
                    />
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
                        <Button type="submit" disabled={update.isPending}>
                            Lagre
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ApiKeyFields({
    name,
    description,
    permissionsRaw,
    onNameChange,
    onDescriptionChange,
    onPermissionsChange,
}: {
    name: string;
    description: string;
    permissionsRaw: string;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onPermissionsChange: (value: string) => void;
}) {
    return (
        <FieldGroup>
            <Field>
                <FieldLabel htmlFor="api-key-name">Navn</FieldLabel>
                <Input
                    id="api-key-name"
                    required
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="f.eks. Wiki-integrasjon"
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="api-key-description">
                    Beskrivelse
                </FieldLabel>
                <Textarea
                    id="api-key-description"
                    required
                    rows={2}
                    value={description}
                    onChange={(event) =>
                        onDescriptionChange(event.target.value)
                    }
                    placeholder="Hva brukes nøkkelen til?"
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="api-key-permissions">
                    Tilganger (én per linje)
                </FieldLabel>
                <Textarea
                    id="api-key-permissions"
                    rows={4}
                    value={permissionsRaw}
                    onChange={(event) =>
                        onPermissionsChange(event.target.value)
                    }
                    placeholder={"email:send\nnews:create"}
                />
            </Field>
        </FieldGroup>
    );
}

function SecretRevealDialog({
    secret,
    onClose,
}: {
    secret: string | null;
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
                    <DialogTitle>API-nøkkel opprettet</DialogTitle>
                    <DialogDescription>
                        Kopier nøkkelen nå — du kan ikke se den igjen.
                    </DialogDescription>
                </DialogHeader>
                {secret && (
                    <Card>
                        <CardContent className="p-4">
                            <code className="text-sm break-all">{secret}</code>
                        </CardContent>
                        <CardFooter>
                            <Button
                                type="button"
                                onClick={() =>
                                    void navigator.clipboard.writeText(secret)
                                }
                            >
                                Kopier nøkkel
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

function parsePermissions(raw: string): string[] {
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function TableSkeleton() {
    return (
        <Card>
            <CardContent className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                ))}
            </CardContent>
        </Card>
    );
}
