import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";

type PaginateButtonProps = {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
};

export function PaginateButton({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
}: PaginateButtonProps) {
    if (!hasNextPage) return null;

    return (
        <div className="flex justify-center pt-4">
            <Button
                variant="outline"
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
            >
                {isFetchingNextPage && <Loader2 className="animate-spin" />}
                Last inn mer
            </Button>
        </div>
    );
}
