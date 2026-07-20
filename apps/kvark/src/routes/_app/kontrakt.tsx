import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { ActiveContract } from "@tihlde/sdk";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Field, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { SignatureInput } from "@tihlde/ui/ui/signature-input";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    getActiveContractQuery,
    getMySignatureQuery,
    signContractMutation,
} from "#/api/queries/contracts";

// The signed PDF is a private asset streamed by the API, so it is linked
// directly rather than fetched through the SDK. A top-level navigation carries
// the session cookie, which is what the route authorizes against.
const SIGNED_PDF_URL = new URL(
    "api/contracts/signed-pdf",
    import.meta.env.VITE_API_URL ?? "https://photon.tihlde.org/",
).toString();

export const Route = createFileRoute("/_app/kontrakt")({
    component: KontraktPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getActiveContractQuery()),
});

function KontraktPage() {
    const { data: contract } = useSuspenseQuery(getActiveContractQuery());

    return (
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1>Frivillighetskontrakt</h1>
                <p>
                    Les gjennom kontrakten og signer for å bekrefte din
                    frivillighetsavtale.
                </p>
            </div>
            {contract ? (
                <KontraktViewer contract={contract} />
            ) : (
                <Card>
                    <CardContent className="py-8">
                        <p>Ingen aktiv kontrakt</p>
                        <p>
                            Det finnes ingen aktiv frivillighetskontrakt å
                            signere akkurat nå.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function KontraktViewer({ contract }: { contract: ActiveContract }) {
    const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const { data: session } = useQuery(authQueryOptions);
    const { data: signature } = useQuery(getMySignatureQuery());
    const signContract = useMutation(signContractMutation);

    // Pre-filled from the session, but editable: the signer decides what their
    // signature reads, and it is stored verbatim.
    const [signedName, setSignedName] = useState("");
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(
        null,
    );

    useEffect(() => {
        if (session?.user?.name) setSignedName(session.user.name);
    }, [session?.user?.name]);

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

    if (signature?.hasSigned) {
        const signedAt = signature.signedAt
            ? new Date(signature.signedAt).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
              })
            : null;

        return (
            <Card>
                <CardContent className="flex flex-col items-start gap-4 py-8">
                    <div className="flex flex-col gap-1">
                        <p>Kontrakt signert</p>
                        {signedAt && <p>Du signerte kontrakten {signedAt}.</p>}
                    </div>
                    <Button
                        render={
                            <a
                                href={SIGNED_PDF_URL}
                                target="_blank"
                                rel="noreferrer"
                            />
                        }
                    >
                        <Download className="mr-1.5 size-4" />
                        Last ned signert kontrakt
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const isLoggedIn = Boolean(session);

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
                    {contract.downloadUrl ? (
                        <iframe
                            src={contract.downloadUrl}
                            title={contract.title}
                            className="h-full w-full"
                        />
                    ) : (
                        <div style={{ height: "200vh" }} />
                    )}
                    <div ref={sentinelRef} style={{ height: "4px" }} />
                </div>
                {!hasScrolledToEnd && (
                    <p>
                        Scroll til bunnen av kontrakten for å aktivere
                        signeringsknappen.
                    </p>
                )}
                {signContract.isError && <p>{signContract.error.message}</p>}
                {isLoggedIn ? (
                    <>
                        <Field>
                            <FieldLabel htmlFor="signed-name">
                                Fullt navn
                            </FieldLabel>
                            <Input
                                id="signed-name"
                                value={signedName}
                                onChange={(e) => setSignedName(e.target.value)}
                                autoComplete="name"
                            />
                        </Field>
                        <SignatureInput
                            name={signedName}
                            onChange={setSignatureDataUrl}
                        />
                        <Button
                            disabled={
                                !hasScrolledToEnd ||
                                !signedName.trim() ||
                                !signatureDataUrl ||
                                signContract.isPending
                            }
                            onClick={() =>
                                signatureDataUrl &&
                                signContract.mutate({
                                    signedName: signedName.trim(),
                                    signatureDataUrl,
                                })
                            }
                            className="w-full"
                        >
                            Signer kontrakt
                        </Button>
                    </>
                ) : (
                    <Button
                        render={
                            <Link
                                to="/login"
                                search={{ redirectTo: "/kontrakt" }}
                            />
                        }
                        className="w-full"
                    >
                        Logg inn for å signere
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
