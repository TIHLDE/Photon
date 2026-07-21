import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Plus } from "lucide-react";
import { Suspense, useState } from "react";

import { authClientWithRedirect } from "#/api/auth";
import {
    createQRCodeMutation,
    deleteQRCodeMutation,
    getQRCodesQuery,
} from "#/api/queries/qr-codes";
import { QRCodeCard } from "#/components/qr-code-card";

export const Route = createFileRoute("/_app/qr-koder")({
    component: QRCodesPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getQRCodesQuery()),
});

function QRCodeGridSkeleton() {
    return (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="flex flex-col gap-3">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="aspect-square w-full" />
                    <Skeleton className="h-9 w-full" />
                </li>
            ))}
        </ul>
    );
}

function QRCodeGrid() {
    const { data: qrCodes } = useSuspenseQuery(getQRCodesQuery());
    const remove = useMutation(deleteQRCodeMutation);

    if (qrCodes.length === 0) {
        return (
            <p className="text-muted-foreground">
                Du har ingen QR koder ennå. Opprett din første kode over.
            </p>
        );
    }

    return (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {qrCodes.map((qrCode) => (
                <li key={qrCode.id}>
                    <QRCodeCard
                        name={qrCode.name}
                        content={qrCode.content}
                        deleting={
                            remove.isPending &&
                            remove.variables?.qrCodeId === qrCode.id
                        }
                        onDelete={() => remove.mutate({ qrCodeId: qrCode.id })}
                    />
                </li>
            ))}
        </ul>
    );
}

function CreateQRCodeDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [error, setError] = useState<string | null>(null);

    const create = useMutation(createQRCodeMutation);

    function reset() {
        setName("");
        setContent("");
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            await create.mutateAsync({ data: { name, content } });
            reset();
            onOpenChange(false);
        } catch {
            setError("Kunne ikke opprette QR koden. Prøv igjen.");
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
                        <DialogTitle>Ny QR kode</DialogTitle>
                        <DialogDescription>
                            Opprett en ny QR kode
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="qr-code-name">Navn</FieldLabel>
                            <Input
                                id="qr-code-name"
                                type="text"
                                required
                                maxLength={100}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Skriv her..."
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="qr-code-content">
                                Innhold
                            </FieldLabel>
                            <Input
                                id="qr-code-content"
                                type="text"
                                required
                                maxLength={2000}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Skriv her..."
                            />
                            <FieldDescription>
                                En link eller tekst som QR koden skal lede til
                            </FieldDescription>
                        </Field>
                    </FieldGroup>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
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
                            {create.isPending ? "Oppretter..." : "Opprett"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function QRCodesPage() {
    const [createOpen, setCreateOpen] = useState(false);

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl">QR koder</h1>
                    <p className="text-muted-foreground">
                        Opprett og administrer QR koder
                    </p>
                </div>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Opprett ny kode
                </Button>
            </div>

            <Suspense fallback={<QRCodeGridSkeleton />}>
                <QRCodeGrid />
            </Suspense>

            <CreateQRCodeDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </div>
    );
}
