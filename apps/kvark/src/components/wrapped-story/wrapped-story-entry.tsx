import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Play } from "lucide-react";
import type { ReactElement } from "react";

type WrappedStoryEntryProps = {
    /** Lenken til storyen, f.eks. en `<Link>`. */
    storyLink: ReactElement;
};

/** På arrangementssida når storyen er publisert. */
export function WrappedStoryEntry({ storyLink }: WrappedStoryEntryProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Wrapped er klar</CardTitle>
                <CardDescription>
                    Se bildene deltakerne tok på arrangementet.
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button className="w-full" render={storyLink}>
                    <Play />
                    Se story
                </Button>
            </CardFooter>
        </Card>
    );
}
