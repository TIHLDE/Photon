import { Card, CardContent, CardHeader } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

export function WrappedCameraSettingsSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-col gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-14 w-40" />
            </CardContent>
        </Card>
    );
}

export function WrappedPhotoGridSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-28" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                    <Skeleton key={index} className="aspect-[3/4] w-full" />
                ))}
            </div>
        </div>
    );
}
