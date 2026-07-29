import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { Input } from "@tihlde/ui/ui/input";
import { Spinner } from "@tihlde/ui/ui/spinner";

/**
 * Why a Feide login came back without signing anyone in.
 *
 * These are the two outcomes the backend can produce for a member who is not
 * yet linked; every other failure is a genuine error and is not handled here.
 */
export type FeideSignInIssueReason = "signup_disabled" | "account_not_linked";

export type FeideSignInIssueProps = {
    reason: FeideSignInIssueReason;
    /** Replays the Feide login, this time allowing a new account. */
    onRegisterAsNew: () => void;
    /** Reveals the username/password form, the route to an existing account. */
    onUseExistingAccount: () => void;
    /** Requests a verification link for an address the member types in. */
    onSendVerification: (email: string) => void;
    verificationSending?: boolean;
    verificationSent?: boolean;
    loading?: boolean;
};

/**
 * Shown on the login page when Feide authenticated the person, but we could
 * not safely decide which account is theirs.
 *
 * Kept to a title, one line and the action: this interrupts a login, where
 * people want to get on with it rather than read.
 */
export function FeideSignInIssue({
    reason,
    onRegisterAsNew,
    onUseExistingAccount,
    onSendVerification,
    verificationSending = false,
    verificationSent = false,
    loading = false,
}: FeideSignInIssueProps) {
    if (reason === "account_not_linked") {
        return (
            <VerifyEmailPrompt
                onSend={onSendVerification}
                sending={verificationSending}
                sent={verificationSent}
                onUseExistingAccount={onUseExistingAccount}
            />
        );
    }

    return (
        <Alert>
            <AlertTitle>Har du vært medlem før?</AlertTitle>
            <AlertDescription>
                Vi fant ingen bruker som passer til Feide-kontoen din.
            </AlertDescription>
            <div className="mt-3 flex flex-col gap-2">
                <Button
                    type="button"
                    variant="default"
                    onClick={onUseExistingAccount}
                >
                    Ja, jeg har bruker
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onRegisterAsNew}
                    disabled={loading}
                >
                    {loading ? (
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
 * A member whose account we found but could not attach Feide to, because their
 * email was never verified — true of every account the Lepton migration
 * created. Verifying it themselves is both the fix and the proof that the
 * account is theirs, which is why we ask instead of setting the flag for them.
 */
function VerifyEmailPrompt({
    onSend,
    sending,
    sent,
    onUseExistingAccount,
}: {
    onSend: (email: string) => void;
    sending: boolean;
    sent: boolean;
    onUseExistingAccount: () => void;
}) {
    const [email, setEmail] = useState("");

    if (sent) {
        return (
            <Alert>
                <AlertTitle>Sjekk innboksen din</AlertTitle>
                <AlertDescription>
                    Finnes adressen hos oss, har vi sendt en lenke. Åpne den, så
                    kan du logge inn med Feide.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert>
            <AlertTitle>Bekreft e-posten din</AlertTitle>
            <AlertDescription>
                Skriv inn e-posten du bruker på TIHLDE, så sender vi en lenke.
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
                <Button
                    type="button"
                    variant="link"
                    onClick={onUseExistingAccount}
                >
                    Husker du ikke e-posten?
                </Button>
            </form>
        </Alert>
    );
}
