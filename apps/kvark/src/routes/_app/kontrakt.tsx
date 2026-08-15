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
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Field, FieldLabel } from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import { SignatureInput } from "@tihlde/ui/ui/signature-input";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { authClientWithRedirect, authQueryOptions } from "#/api/auth";
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
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getActiveContractQuery()),
});

function KontraktPage() {
    const { data: contract } = useSuspenseQuery(getActiveContractQuery());

    return (
        /* Bredere enn resten av appen på store skjermer: en A4-side i en
           3xl-spalte blir for liten til å leses uten å zoome. */
        <div className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 lg:max-w-5xl">
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
    // Bekreftelse framfor en scrollesperre: kontrakten vises i en iframe, så vi
    // ser ikke at noen scroller inne i den. Sperren målte i praksis bare noen
    // få piksler i den ytre boksen, og løste seg selv eller aldri avhengig av
    // nettleserens avrunding.
    const [hasRead, setHasRead] = useState(false);

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

    const blockedReason = !signedName.trim()
        ? "Fyll inn fullt navn."
        : !signatureDataUrl
          ? "Skriv eller tegn signaturen din."
          : !hasRead
            ? "Huk av for at du har lest kontrakten."
            : signContract.isPending
              ? "Signerer …"
              : null;

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
                {/* Høy nok til at en A4-side er lesbar uten å zoome. Lavere på
                    små skjermer, så signeringsfeltene ikke havner utenfor. */}
                <div className="h-[70vh] w-full lg:h-[85vh]">
                    {contract.downloadUrl ? (
                        <iframe
                            src={contract.downloadUrl}
                            title={contract.title}
                            className="h-full w-full"
                        />
                    ) : null}
                </div>
                {signContract.isError && <p>{signContract.error.message}</p>}
                {isLoggedIn ? (
                    // Skjemaet følger ikke den brede spalten — inndatafelt på
                    // over 1000 px er verre å bruke, ikke bedre.
                    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
                        <Label className="flex items-start gap-3">
                            <Checkbox
                                className="shrink-0"
                                checked={hasRead}
                                disabled={signContract.isPending}
                                onCheckedChange={(checked) =>
                                    setHasRead(checked === true)
                                }
                            />
                            <span>
                                Jeg har lest og godtar frivillighetskontrakten
                            </span>
                        </Label>
                        <Button
                            disabled={Boolean(blockedReason)}
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
                        {/* Uten dette var en deaktivert knapp det eneste
                            signalet, og testerne gjettet på hvorfor. */}
                        {blockedReason && !signContract.isPending && (
                            <p>{blockedReason}</p>
                        )}
                    </div>
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
