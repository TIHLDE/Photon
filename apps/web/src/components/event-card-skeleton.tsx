import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function EventCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <Skeleton className="aspect-[2/1] w-full rounded-none" />
            <div className="space-y-2 p-4">
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
            </div>
        </Card>
    );
}
