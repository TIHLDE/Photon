import { createFileRoute } from "@tanstack/react-router";
import type { ActiveContract, SignatureStatus } from "@tihlde/sdk";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { useEffect, useRef, useState } from "react";

const MOCK_CONTRACT: ActiveContract = {
    id: "b3f1c2d4-0001-4e5a-9b8c-111111111111",
    title: "Frivillighetskontrakt 2026",
    version: "2026.1",
    fileKey: "contracts/frivillighetskontrakt-2026.pdf",
    isActive: true,
    createdAt: "2025-12-01T10:00:00.000Z",
    updatedAt: "2025-12-01T10:00:00.000Z",
    downloadUrl: "",
};

export const Route = createFileRoute("/_app/kontrakt")({
    component: KontraktPage,
});

function KontraktPage() {
    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1>Frivillighetskontrakt</h1>
                <p>
                    Les gjennom kontrakten og signer for å bekrefte din
                    frivillighetsavtale.
                </p>
            </div>
            <KontraktViewer contract={MOCK_CONTRACT} />
        </div>
    );
}

function KontraktViewer({ contract }: { contract: ActiveContract }) {
    const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
    const [signature, setSignature] = useState<SignatureStatus>({
        hasSigned: false,
        signedAt: null,
    });
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

    if (signature.hasSigned) {
        const signedAt = signature.signedAt
            ? new Date(signature.signedAt).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
              })
            : null;

        return (
            <Card>
                <CardContent className="py-8">
                    <p>Kontrakt signert</p>
                    {signedAt && <p>Du signerte kontrakten {signedAt}.</p>}
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
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div
                    ref={containerRef}
                    className="w-full overflow-y-auto"
                    style={{ height: "65vh" }}
                >
                    <div style={{ height: "200vh" }} />
                    <div ref={sentinelRef} style={{ height: "4px" }} />
                </div>
                {!hasScrolledToEnd && (
                    <p>
                        Scroll til bunnen av kontrakten for å aktivere
                        signeringsknappen.
                    </p>
                )}
                <Button
                    disabled={!hasScrolledToEnd}
                    onClick={() =>
                        setSignature({
                            hasSigned: true,
                            signedAt: new Date().toISOString(),
                        })
                    }
                    className="w-full"
                >
                    Signer kontrakt
                </Button>
            </CardContent>
        </Card>
    );
}

export function KontraktSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton style={{ height: "65vh" }} />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
}
