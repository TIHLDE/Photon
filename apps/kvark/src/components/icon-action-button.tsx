import { Button } from "@tihlde/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

type IconActionButtonProps = {
    icon: LucideIcon;
    label: string;
    variant?: "ghost" | "favorite";
    render?: ReactElement;
    onClick?: () => void;
};

export function IconActionButton({
    icon: Icon,
    label,
    variant = "ghost",
    render,
    onClick,
}: IconActionButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant={variant}
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
