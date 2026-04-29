import { Button } from "@tihlde/ui/ui/button";

import type { Law } from "#/routes/_app/grupper.$slug.mock";

type GroupLawItemProps = {
    law: Law;
    onEdit: () => void;
};

export function GroupLawItem({ law, onEdit }: GroupLawItemProps) {
    return (
        <Button
            variant="ghost"
            onClick={onEdit}
            className="flex h-auto w-full flex-col items-stretch gap-3 px-4 py-4 text-left whitespace-normal"
        >
            <div className="flex items-baseline gap-3">
                <h3 className="font-medium">
                    {law.paragraph} - {law.title}
                </h3>
                <span className="text-sm text-muted-foreground">
                    Bøter: {law.amount}
                </span>
            </div>
            <p className="pl-6 text-sm text-muted-foreground">
                {law.description}
            </p>
        </Button>
    );
}
