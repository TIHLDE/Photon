import { createFileRoute } from "@tanstack/react-router";
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
import { CheckCircle2, Upload, Zap } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/opptak")({
    component: OpptakAdminPage,
});

const MOCK_CONTRACTS: Contract[] = [
    {
        id: "b3f1c2d4-0001-4e5a-9b8c-111111111111",
        title: "Frivillighetskontrakt 2026",
        version: "2026.1",
        fileKey: "contracts/frivillighetskontrakt-2026.pdf",
        isActive: true,
        createdAt: "2025-12-01T10:00:00.000Z",
        updatedAt: "2025-12-01T10:00:00.000Z",
    },
    {
        id: "b3f1c2d4-0002-4e5a-9b8c-222222222222",
        title: "Frivillighetskontrakt 2025",
        version: "2025.1",
        fileKey: "contracts/frivillighetskontrakt-2025.pdf",
        isActive: false,
        createdAt: "2024-12-01T10:00:00.000Z",
        updatedAt: "2024-12-01T10:00:00.000Z",
    },
];

function OpptakAdminPage() {
    const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);

    function handleCreate(title: string, version: string) {
        const next: Contract = {
            id: crypto.randomUUID(),
            title,
            version,
            fileKey: `contracts/${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
            isActive: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setContracts((prev) => [next, ...prev]);
    }

    function handleActivate(id: string) {
        setContracts((prev) =>
            prev.map((c) => ({
                ...c,
                isActive: c.id === id,
                updatedAt: c.id === id ? new Date().toISOString() : c.updatedAt,
            })),
        );
    }

    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1>Kontraktstyring</h1>
                <p>Last opp og administrer frivillighetskontrakter.</p>
            </div>
            <UploadContractCard onCreate={handleCreate} />
            <ContractListCard
                contracts={contracts}
                onActivate={handleActivate}
            />
        </div>
    );
}

function UploadContractCard({
    onCreate,
}: {
    onCreate: (title: string, version: string) => void;
}) {
    const [title, setTitle] = useState("");
    const [version, setVersion] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!file) return;
        onCreate(title, version);
        setSuccessMsg(`Kontrakt "${title}" v${version} opprettet.`);
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
                    {successMsg && (
                        <Alert>
                            <CheckCircle2 className="size-4" />
                            <AlertTitle>Opprettet</AlertTitle>
                            <AlertDescription>{successMsg}</AlertDescription>
                        </Alert>
                    )}
                    <Button
                        type="submit"
                        disabled={!file}
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
