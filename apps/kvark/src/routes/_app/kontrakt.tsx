import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import type { ActiveContract, SignatureStatus } from "@tihlde/sdk";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_app/kontrakt")({
    component: KontraktPage,
});

const MOCK_CONTRACT: ActiveContract = {
    id: "b3f1c2d4-0001-4e5a-9b8c-111111111111",
    title: "Frivillighetskontrakt 2026",
    version: "2026.1",
    fileKey: "contracts/frivillighetskontrakt-2026.pdf",
    isActive: true,
    createdAt: "2025-12-01T10:00:00.000Z",
    updatedAt: "2025-12-01T10:00:00.000Z",
    downloadUrl: "https://www.w3.org/WAI/WCAG21/wcag21.pdf",
};

const MOCK_SIGNATURE: SignatureStatus | null = null;

function KontraktPage() {
    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Frivillighetskontrakt</h1>
                <p className="text-sm text-muted-foreground">
                    Les gjennom kontrakten og signer for å bekrefte din
                    frivillighetsavtale.
                </p>
            </div>
            <KontraktViewer
                contract={MOCK_CONTRACT}
                signature={MOCK_SIGNATURE}
            />
        </div>
    );
}

function KontraktViewer({
    contract,
    signature,
}: {
    contract: ActiveContract;
    signature: SignatureStatus | null;
}) {
    const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
    const [signed, setSigned] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const sentinel = sentinelRef.current;
        if (!container || !sentinel) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) setHasScrolledToEnd(true);
            },
            { root: container, threshold: 0.1 },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    const alreadySigned = signed || (signature?.hasSigned ?? false);

    if (alreadySigned) {
        const signedAt = signed
            ? new Date().toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
              })
            : signature?.signedAt
              ? new Date(signature.signedAt).toLocaleDateString("nb-NO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })
              : null;

        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="font-medium">Kontrakt signert</p>
                    {signedAt && (
                        <p className="text-sm text-muted-foreground">
                            Du signerte kontrakten {signedAt}.
                        </p>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{contract.title}</CardTitle>
                        <CardDescription>
                            Versjon {contract.version}
                        </CardDescription>
                    </div>
                    <Badge variant="secondary">Aktiv</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div
                    ref={containerRef}
                    className="w-full overflow-y-auto rounded-md border"
                    style={{ height: "65vh" }}
                >
                    <iframe
                        src={contract.downloadUrl}
                        title="Frivillighetskontrakt PDF"
                        width="100%"
                        style={{ height: "200vh", display: "block", border: 0 }}
                    />
                    <div ref={sentinelRef} style={{ height: "4px" }} />
                </div>
                {!hasScrolledToEnd && (
                    <p className="text-center text-sm text-muted-foreground">
                        Scroll til bunnen av kontrakten for å aktivere
                        signeringsknappen.
                    </p>
                )}
                <Button
                    disabled={!hasScrolledToEnd}
                    onClick={() => setSigned(true)}
                    className="w-full"
                >
                    Signer kontrakt
                </Button>
            </CardContent>
        </Card>
    );
}
