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
import type { PlacementFields } from "@tihlde/ui/complex/pdf-placement";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { CheckCircle2, Upload, XCircle, Zap } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";

import { Stagger } from "@tihlde/ui/ui/motion";

import { requireAdminSection } from "#/lib/admin-access";
import { uploadAssetMutation } from "#/api/queries/assets";
import { AdminPageHeader } from "#/components/admin-page-header";
import { useAnyScopePermission } from "#/hooks/use-permission";
import {
    activateContractMutation,
    createContractMutation,
    getContractListQuery,
} from "#/api/queries/contracts";

// react-pdf needs canvas and a worker, so it must never load during SSR. It is
// only rendered once a file is picked, which is necessarily client-side.
const PdfPlacement = lazy(async () => ({
    default: (await import("@tihlde/ui/complex/pdf-placement")).PdfPlacement,
}));

export const Route = createFileRoute("/admin/opptak")({
    component: OpptakAdminPage,
    beforeLoad: async ({ location }) => {
        await requireAdminSection(location.href, "opptak");
    },
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getContractListQuery()),
});

function OpptakAdminPage() {
    const { data: contracts } = useSuspenseQuery(getContractListQuery());
    const activateContract = useMutation(activateContractMutation);
    const canUpload = useAnyScopePermission([
        "contracts:create",
        "contracts:manage",
    ]);
    const canActivate = useAnyScopePermission([
        "contracts:update",
        "contracts:manage",
    ]);

    return (
        <Stagger
            render={
                <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" />
            }
        >
            <AdminPageHeader
                title="Kontraktstyring"
                description="Last opp og administrer frivillighetskontrakter."
            />
            {canUpload ? <UploadContractCard /> : null}
            <ContractListCard
                contracts={contracts}
                onActivate={
                    canActivate
                        ? (id) => activateContract.mutate({ id })
                        : undefined
                }
            />
        </Stagger>
    );
}

function UploadContractCard() {
    const [title, setTitle] = useState("");
    const [version, setVersion] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [fields, setFields] = useState<PlacementFields>({
        signature: null,
        name: null,
    });

    // Render the chosen file straight from memory; it is not uploaded until
    // submit, so placement happens before the asset exists.
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!file) {
            setFileUrl(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setFileUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const uploadAsset = useMutation(uploadAssetMutation);
    const createContract = useMutation(createContractMutation);

    const isPending = uploadAsset.isPending || createContract.isPending;
    const errorMessage =
        uploadAsset.error?.message ?? createContract.error?.message ?? null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!file || !fields.signature) return;

        const formData = new FormData();
        formData.append("file", file);

        const upload = await uploadAsset.mutateAsync({ formData });
        await createContract.mutateAsync({
            title,
            version,
            fileKey: upload.key,
            signaturePlacement: fields.signature,
            namePlacement: fields.name,
        });

        setTitle("");
        setVersion("");
        setFile(null);
        setFields({ signature: null, name: null });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Last opp ny kontrakt</CardTitle>
                <CardDescription>
                    Fyll inn metadata, velg PDF-en og plasser signaturfeltet der
                    signaturen skal stemples. Kontrakten er inaktiv til den
                    aktiveres.
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
                    {fileUrl && (
                        <Suspense
                            fallback={<Skeleton className="h-96 w-full" />}
                        >
                            <PdfPlacement
                                fileUrl={fileUrl}
                                fields={fields}
                                onChange={setFields}
                            />
                        </Suspense>
                    )}
                    {file && !fields.signature && (
                        <Alert>
                            <XCircle className="size-4" />
                            <AlertTitle>Mangler signaturfelt</AlertTitle>
                            <AlertDescription>
                                Plasser signaturfeltet på dokumentet før du
                                lagrer, ellers vet vi ikke hvor signaturen skal
                                stemples.
                            </AlertDescription>
                        </Alert>
                    )}
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
                        disabled={!file || !fields.signature || isPending}
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
    onActivate?: (id: string) => void;
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
    /** Omitted when the viewer may not activate contracts — no button then. */
    onActivate?: (id: string) => void;
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
                {!contract.isActive && onActivate && (
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
