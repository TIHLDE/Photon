import { Button } from "@tihlde/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tihlde/ui/ui/tooltip";
import { SmilePlus } from "lucide-react";

export type Reaction = {
    emoji: string;
    count: number;
    reacted?: boolean;
};

type ReactionsBarProps = {
    reactions: Reaction[];
    onReact?: (emoji: string) => void;
    onAdd?: () => void;
};

export function ReactionsBar({ reactions, onReact, onAdd }: ReactionsBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {reactions.map((reaction) => (
                <Button
                    key={reaction.emoji}
                    variant={reaction.reacted ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => onReact?.(reaction.emoji)}
                >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                </Button>
            ))}
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onAdd}
                            aria-label="Legg til reaksjon"
                        >
                            <SmilePlus />
                        </Button>
                    }
                />
                <TooltipContent>Legg til reaksjon</TooltipContent>
            </Tooltip>
        </div>
    );
}
