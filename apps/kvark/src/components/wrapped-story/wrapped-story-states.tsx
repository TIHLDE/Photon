import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { StorySlide } from "@tihlde/ui/ui/story-viewer";
import { Images } from "lucide-react";
import type { ReactElement } from "react";

/** Mens storyen lastes: forsiden i grått. */
export function WrappedStorySkeleton() {
    return (
        <StorySlide>
            <div className="flex w-full max-w-sm flex-col items-center gap-3 px-6">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-40" />
            </div>
        </StorySlide>
    );
}

type WrappedStoryUnavailableProps = {
    /** Lenken tilbake til arrangementet. */
    backLink: ReactElement;
};

/** Storyen finnes ikke, eller er ikke publisert ennå. */
export function WrappedStoryUnavailable({
    backLink,
}: WrappedStoryUnavailableProps) {
    return (
        <StorySlide>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Images />
                    </EmptyMedia>
                    <EmptyTitle>Storyen er ikke publisert ennå</EmptyTitle>
                    <EmptyDescription>
                        Du får et varsel når bildene fra arrangementet er klare.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" render={backLink}>
                        Tilbake til arrangementet
                    </Button>
                </EmptyContent>
            </Empty>
        </StorySlide>
    );
}
