import { Button } from "@tihlde/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

type IconActionButtonProps = {
    icon: LucideIcon;
    label: string;
    render?: ReactElement;
    onClick?: () => void;
};

export function IconActionButton({
    icon: Icon,
    label,
    render,
    onClick,
}: IconActionButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={label}
                        onClick={onClick}
                        render={render}
                    >
                        <Icon />
                    </Button>
                }
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
