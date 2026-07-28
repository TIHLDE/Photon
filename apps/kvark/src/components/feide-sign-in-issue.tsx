import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
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
    /**
     * False once that form is already open — the button would then be a
     * no-op sitting above the thing it was meant to reveal.
     */
    showExistingAccountAction?: boolean;
    loading?: boolean;
};

const COPY: Record<
    FeideSignInIssueReason,
    { title: string; description: string }
> = {
    /**
     * No user matched the Feide identity at all. The honest framing is a
     * question rather than an error: we genuinely cannot tell a new member
     * from a returning one whose old username differs from their NTNU one.
     */
    signup_disabled: {
        title: "Har du vært medlem i TIHLDE før?",
        description:
            "Vi fant ingen bruker som passer til Feide-kontoen din. Har du brukt TIHLDE-nettsiden tidligere, vil vi helst koble deg til den gamle brukeren din, så du beholder påmeldinger, bøter og gruppene dine.",
    },
    /**
     * A user *was* found, but Better Auth refused to attach Feide to it. In
     * practice this is a migrated member whose email was never verified.
     */
    account_not_linked: {
        title: "Vi fant brukeren din, men fikk ikke koblet Feide til den",
        description:
            "Du har en TIHLDE-bruker fra før, men den kunne ikke kobles til Feide automatisk. Logg inn med brukernavn og passord i mellomtiden — bruk «Glemt passord?» om du ikke har satt et.",
    },
};

/**
 * Shown on the login page when Feide authenticated the person, but we could
 * not safely decide which account is theirs.
 *
 * Deliberately offers the existing-account route first: choosing "new" when
 * you already have an account is the expensive mistake, because it strands
 * your history on a user you can no longer reach.
 */
export function FeideSignInIssue({
    reason,
    onRegisterAsNew,
    onUseExistingAccount,
    showExistingAccountAction = true,
    loading = false,
}: FeideSignInIssueProps) {
    const { title, description } = COPY[reason];

    return (
        <Alert>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
            <div className="mt-3 flex flex-col gap-2">
                {showExistingAccountAction && (
                    <Button
                        type="button"
                        variant="default"
                        onClick={onUseExistingAccount}
                    >
                        Ja, jeg har bruker fra før
                    </Button>
                )}
                {reason === "signup_disabled" && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onRegisterAsNew}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Spinner />
                                <span>Oppretter bruker...</span>
                            </>
                        ) : (
                            "Nei, jeg er ny — opprett bruker"
                        )}
                    </Button>
                )}
            </div>
        </Alert>
    );
}
