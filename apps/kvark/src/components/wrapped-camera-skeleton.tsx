import { Card, CardContent, CardHeader } from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";

export function WrappedCameraSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-col gap-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
}
