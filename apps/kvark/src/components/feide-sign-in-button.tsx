import { Button } from "@tihlde/ui/ui/button";
import { Spinner } from "@tihlde/ui/ui/spinner";

export type FeideSignInButtonProps = {
    onSignIn: () => void;
    loading?: boolean;
    disabled?: boolean;
};

/**
 * Dumb button that kicks off Feide login. The route owns the actual sign-in
 * call and passes it in via `onSignIn`; this component only renders.
 */
export function FeideSignInButton({
    onSignIn,
    loading = false,
    disabled = false,
}: FeideSignInButtonProps) {
    return (
        <Button
            type="button"
            variant="outline"
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
                <span>Logg inn med Feide</span>
            )}
        </Button>
    );
}
