import { Button } from "@tihlde/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import { Share2 } from "lucide-react";

type ShareButtonProps = {
    onShare?: () => void;
    label?: string;
};

export function ShareButton({ onShare, label = "Del" }: ShareButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onShare}
                        aria-label={label}
                    >
                        <Share2 />
                    </Button>
                }
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
