import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function JobPostCardSkeleton() {
    return (
        <Card className="flex gap-4 p-4">
            <Skeleton className="hidden size-16 rounded-md sm:block" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </Card>
    );
}
