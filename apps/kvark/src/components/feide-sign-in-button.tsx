import { Button } from "@tihlde/ui/ui/button";
import { Spinner } from "@tihlde/ui/ui/spinner";

export type FeideSignInButtonProps = {
    onSignIn: () => void;
    loading?: boolean;
    disabled?: boolean;
    /**
     * Button emphasis. Defaults to "outline" so login keeps Feide as a
     * secondary action; register passes "default" to make it the primary CTA.
     */
    variant?: "default" | "outline";
    /** Overrides the resting label, e.g. "Registrer med Feide". */
    label?: string;
};

/**
 * Dumb button that kicks off Feide login. The route owns the actual sign-in
 * call and passes it in via `onSignIn`; this component only renders.
 */
export function FeideSignInButton({
    onSignIn,
    loading = false,
    disabled = false,
    variant = "outline",
    label = "Logg inn med Feide",
}: FeideSignInButtonProps) {
    return (
        <Button
            type="button"
            variant={variant}
            className="w-full"
            onClick={onSignIn}
            disabled={disabled || loading}
        >
            {loading ? (
                <>
                    <Spinner />
                    <span>Sender deg til Feide...</span>
                </>
            ) : (
                <span>{label}</span>
            )}
        </Button>
    );
}
