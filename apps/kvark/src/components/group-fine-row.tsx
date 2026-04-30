import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";
import { ChevronRight, HandCoins } from "lucide-react";

import type { Fine } from "#/mock/group-detail";

type GroupFineRowProps = {
    fine: Fine;
    index: number;
    onOpen: () => void;
};

export function GroupFineRow({ fine, index, onOpen }: GroupFineRowProps) {
    return (
        <Card
            size="sm"
            className="flex-row items-center gap-3 px-3 py-2 cursor-pointer"
            onClick={onOpen}
            role="button"
        >
            <span className="w-6 text-center font-medium">{index}</span>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1 truncate font-medium">
                    {fine.user}
                    {fine.approved ? (
                        <Badge variant="outline">Godkjent</Badge>
                    ) : null}
                    {fine.paid ? (
                        <Badge variant="secondary" className="gap-1">
                            <HandCoins />
                            Betalt
                        </Badge>
                    ) : null}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                    {fine.paragraph} - {fine.title}
                </span>
            </div>
            <ChevronRight />
        </Card>
    );
}
