import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function NewsCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <Skeleton className="aspect-[2/1] w-full rounded-none" />
            <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
            </div>
        </Card>
    );
}
