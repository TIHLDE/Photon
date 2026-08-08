import { Button } from "@tihlde/ui/ui/button";

import type { Law } from "#/lib/group";

type GroupLawItemProps = {
    law: Law;
    /**
     * Omitted when the viewer may not edit the lovverk — the row is then plain
     * text instead of something that looks clickable but does nothing.
     */
    onEdit?: () => void;
};

export function GroupLawItem({ law, onEdit }: GroupLawItemProps) {
    const content = (
        <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="min-w-0 font-medium">
                    {law.paragraph} - {law.title}
                </h3>
                {/* 0 bøter brukes for overskrifter og forklarende paragrafer.
                    «Bøter: 0» leser da som en paragraf man kan bøtelegges
                    etter — skjul tellingen helt i stedet. */}
                {law.amount > 0 ? (
                    <span className="text-sm text-muted-foreground">
                        Bøter: {law.amount}
                    </span>
                ) : null}
            </div>
            <p className="pl-6 text-sm text-muted-foreground">
                {law.description}
            </p>
        </>
    );

    if (!onEdit) {
        return (
            <div className="flex w-full flex-col items-stretch gap-3 px-4 py-4 text-left">
                {content}
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            onClick={onEdit}
            className="flex h-auto w-full flex-col items-stretch gap-3 px-4 py-4 text-left whitespace-normal"
        >
            {content}
        </Button>
    );
}
