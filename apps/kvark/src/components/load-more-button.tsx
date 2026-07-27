import { Button } from "@tihlde/ui/ui/button";
import { Spinner } from "@tihlde/ui/ui/spinner";

export type LoadMoreButtonProps = {
    onClick: () => void;
    isLoading?: boolean;
    label?: string;
};

/**
 * "Last inn mer" for paginated lists. Rendering it is the caller's decision —
 * only show it while `hasNextPage` is true, so it is never a dead button.
 */
export function LoadMoreButton({
    onClick,
    isLoading = false,
    label = "Last inn mer",
}: LoadMoreButtonProps) {
    return (
        <Button
            type="button"
            variant="outline"
            onClick={onClick}
            disabled={isLoading}
        >
            {isLoading && <Spinner className="size-4" />}
            {label}
        </Button>
    );
}
