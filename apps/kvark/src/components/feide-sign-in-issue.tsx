import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Input } from "@tihlde/ui/ui/input";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { Textarea } from "@tihlde/ui/ui/textarea";

/**
 * Why a Feide login came back without signing anyone in.
 *
 * `signup_disabled` means nothing matched at all — either a new member, or one
 * whose Lepton username differs from their NTNU one. `account_not_linked`
 * means we found them but Better Auth would not attach Feide, which for a
 * migrated member always comes down to an unverified email.
 */
export type FeideSignInIssueReason = "signup_disabled" | "account_not_linked";

export type AccountLinkHelpInput = {
    feideName: string;
    contactEmail: string;
    note?: string;
};

export type FeideSignInIssueProps = {
    reason: FeideSignInIssueReason;
    onRegisterAsNew: () => void;
    registering?: boolean;

    onSendVerification: (email: string) => void;
    verificationSending?: boolean;
    verificationSent?: boolean;

    onRequestHelp: (input: AccountLinkHelpInput) => void;
    helpSending?: boolean;
    helpSent?: boolean;
    helpError?: string;
};

type Step = "choose" | "verify" | "help";

/**
 * The one screen a Feide login can land on when we could not decide which
 * account is theirs. Walks: are you new → prove the old address → ask a human.
 */
export function FeideSignInIssue(props: FeideSignInIssueProps) {
    const [step, setStep] = useState<Step>(
        props.reason === "account_not_linked" ? "verify" : "choose",
    );

    if (props.helpSent) {
        return (
            <Alert>
                <AlertTitle>Vi har fått beskjed</AlertTitle>
                <AlertDescription>
                    Index er varslet og kobler kontoen din så snart de har
                    mulighet. Du får svar på e-post.
                </AlertDescription>
            </Alert>
        );
    }

    if (step === "help") {
        return (
            <HelpForm
                onSubmit={props.onRequestHelp}
                sending={props.helpSending ?? false}
                error={props.helpError}
                onBack={() => setStep("verify")}
            />
        );
    }

    if (step === "verify") {
        return (
            <VerifyEmailPrompt
                onSend={props.onSendVerification}
                sending={props.verificationSending ?? false}
                sent={props.verificationSent ?? false}
                onNeedHelp={() => setStep("help")}
            />
        );
    }

    return (
        <Alert>
            {/* "Medlem" and "bruker" are not the same thing: you can have been
                a member for years without thinking of yourself as having an
                account. The account is what the question is about. */}
            <AlertTitle>Har du registrert TIHLDE-bruker tidligere?</AlertTitle>
            <AlertDescription>
                Vi fant ingen bruker som passer til Feide-kontoen din.
            </AlertDescription>
            <div className="mt-3 flex flex-col gap-2">
                <Button type="button" onClick={() => setStep("verify")}>
                    Ja, jeg har bruker
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={props.onRegisterAsNew}
                    disabled={props.registering}
                >
                    {props.registering ? (
                        <>
                            <Spinner />
                            <span>Oppretter...</span>
                        </>
                    ) : (
                        "Nei, jeg er ny"
                    )}
                </Button>
            </div>
        </Alert>
    );
}

/**
 * Confirming the old address is both what unblocks the link and what proves
 * the account is theirs — which is why we ask rather than setting the flag on
 * their behalf.
 */
function VerifyEmailPrompt({
    onSend,
    sending,
    sent,
    onNeedHelp,
}: {
    onSend: (email: string) => void;
    sending: boolean;
    sent: boolean;
    onNeedHelp: () => void;
}) {
    const [email, setEmail] = useState("");

    if (sent) {
        return (
            <Alert>
                <AlertTitle>Sjekk innboksen din</AlertTitle>
                <AlertDescription>
                    Finnes adressen hos oss, har vi sendt en lenke. Åpne den, så
                    kobler vi kontoen til Feide.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            <AlertTitle>Bekreft e-posten din</AlertTitle>
            <AlertDescription>
                Skriv inn e-posten du brukte på den gamle brukeren din.
            </AlertDescription>
            <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (email.trim()) onSend(email.trim());
                }}
            >
                <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="din@epost.no"
                    autoComplete="email"
                    required
                />
                <Button type="submit" disabled={sending}>
                    {sending ? (
                        <>
                            <Spinner />
                            <span>Sender...</span>
                        </>
                    ) : (
                        "Send lenke"
                    )}
                </Button>
                <Button type="button" variant="link" onClick={onNeedHelp}>
                    Husker du ikke e-posten?
                </Button>
            </form>
        </Alert>
    );
}

/**
 * The end of the road for a member who has neither a matching username nor the
 * old address: nothing left can verify them, so a human decides.
 */
function HelpForm({
    onSubmit,
    sending,
    error,
    onBack,
}: {
    onSubmit: (input: AccountLinkHelpInput) => void;
    sending: boolean;
    error?: string;
    onBack: () => void;
}) {
    const [feideName, setFeideName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [note, setNote] = useState("");

    return (
        <Alert>
            <AlertTitle>Be Index koble kontoen</AlertTitle>
            <AlertDescription>
                De finner den gamle brukeren din manuelt.
            </AlertDescription>
            <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (feideName.trim() && contactEmail.trim()) {
                        onSubmit({
                            feideName: feideName.trim(),
                            contactEmail: contactEmail.trim(),
                            note: note.trim() || undefined,
                        });
                    }
                }}
            >
                <Input
                    value={feideName}
                    onChange={(event) => setFeideName(event.target.value)}
                    placeholder="Fullt navn"
                    autoComplete="name"
                    required
                />
                <Input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    placeholder="E-post vi kan svare på"
                    autoComplete="email"
                    required
                />
                <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Husker du noe om den gamle brukeren? (valgfritt)"
                    rows={2}
                />
                <Button type="submit" disabled={sending}>
                    {sending ? (
                        <>
                            <Spinner />
                            <span>Sender...</span>
                        </>
                    ) : (
                        "Send forespørsel"
                    )}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="button" variant="link" onClick={onBack}>
                    Tilbake
                </Button>
            </form>
        </Alert>
    );
}
