import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
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
import type { Contract } from "@tihlde/sdk";
import { CheckCircle2, Upload, XCircle, Zap } from "lucide-react";
import { useState } from "react";

import { uploadAssetMutation } from "#/api/queries/assets";
import {
    activateContractMutation,
    createContractMutation,
    getContractListQuery,
} from "#/api/queries/contracts";

export const Route = createFileRoute("/admin/opptak")({
    component: OpptakAdminPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getContractListQuery()),
});

function OpptakAdminPage() {
    const { data: contracts } = useSuspenseQuery(getContractListQuery());
    const activateContract = useMutation(activateContractMutation);

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1>Kontraktstyring</h1>
                <p>Last opp og administrer frivillighetskontrakter.</p>
            </div>
            <UploadContractCard />
            <ContractListCard
                contracts={contracts}
                onActivate={(id) => activateContract.mutate({ id })}
            />
        </div>
    );
}

function UploadContractCard() {
    const [title, setTitle] = useState("");
    const [version, setVersion] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const uploadAsset = useMutation(uploadAssetMutation);
    const createContract = useMutation(createContractMutation);

    const isPending = uploadAsset.isPending || createContract.isPending;
    const errorMessage =
        uploadAsset.error?.message ?? createContract.error?.message ?? null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        const upload = await uploadAsset.mutateAsync({ formData });
        await createContract.mutateAsync({
            title,
            version,
            fileKey: upload.key,
        });

        setTitle("");
        setVersion("");
        setFile(null);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Last opp ny kontrakt</CardTitle>
                <CardDescription>
                    Last opp PDF-filen til assets-tjenesten, fyll inn metadata,
                    og lagre. Kontrakten er inaktiv til den aktiveres.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="contract-title">
                                Tittel
                            </FieldLabel>
                            <Input
                                id="contract-title"
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Frivillighetskontrakt 2026"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="contract-version">
                                Versjon
                            </FieldLabel>
                            <Input
                                id="contract-version"
                                type="text"
                                required
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                placeholder="2026.1"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="contract-file">
                                PDF-fil
                            </FieldLabel>
                            <Input
                                id="contract-file"
                                type="file"
                                accept="application/pdf"
                                required
                                onChange={(e) =>
                                    setFile(e.target.files?.[0] ?? null)
                                }
                            />
                        </Field>
                    </FieldGroup>
                    {createContract.isSuccess && (
                        <Alert>
                            <CheckCircle2 className="size-4" />
                            <AlertTitle>Opprettet</AlertTitle>
                            <AlertDescription>
                                Kontrakten ble opprettet.
                            </AlertDescription>
                        </Alert>
                    )}
                    {errorMessage && (
                        <Alert variant="destructive">
                            <XCircle className="size-4" />
                            <AlertTitle>Kunne ikke opprette</AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}
                    <Button
                        type="submit"
                        disabled={!file || isPending}
                        className="self-start"
                    >
                        <Upload className="size-4" />
                        Last opp og opprett
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function ContractListCard({
    contracts,
    onActivate,
}: {
    contracts: Contract[];
    onActivate: (id: string) => void;
}) {
    if (!contracts.length) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Kontraktversjoner</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Ingen kontrakter lastet opp ennå.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Kontraktversjoner</CardTitle>
                <CardDescription>
                    Kun én kontrakt kan være aktiv om gangen. Aktivering
                    deaktiverer alle andre.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tittel</TableHead>
                            <TableHead>Versjon</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Opprettet</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contracts.map((contract) => (
                            <ContractRow
                                key={contract.id}
                                contract={contract}
                                onActivate={onActivate}
                            />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ContractRow({
    contract,
    onActivate,
}: {
    contract: Contract;
    onActivate: (id: string) => void;
}) {
    return (
        <TableRow>
            <TableCell>{contract.title}</TableCell>
            <TableCell>{contract.version}</TableCell>
            <TableCell>
                {contract.isActive ? (
                    <Badge variant="default">Aktiv</Badge>
                ) : (
                    <Badge variant="outline">Inaktiv</Badge>
                )}
            </TableCell>
            <TableCell>
                {new Date(contract.createdAt).toLocaleDateString("nb-NO")}
            </TableCell>
            <TableCell>
                {!contract.isActive && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onActivate(contract.id)}
                    >
                        <Zap className="size-4" />
                        Aktivér
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}
