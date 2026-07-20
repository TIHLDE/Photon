import { Button } from "@tihlde/ui/ui/button";
import { ImagePlus } from "lucide-react";

export function ImageDropzone() {
    return (
        <Button
            type="button"
            variant="outline"
            className="flex h-auto w-full flex-col items-center justify-center gap-2 px-4 py-8"
        >
            <ImagePlus className="size-5" />
            <span>Klikk eller dra et bilde hit for å laste opp</span>
        </Button>
    );
}
