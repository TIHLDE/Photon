import { Button } from "@tihlde/ui/ui/button";

import type { ReactionGroup } from "./group-reactions";

const MAX_CHIPS = 4;

type ReactionChipsProps = {
    groups: ReactionGroup[];
    /** Emojien brukeren selv har reagert med, om noen. */
    ownEmoji: string | null;
    disabled: boolean;
    onSelect: (emoji: string) => void;
};

/**
 * De mest brukte emojiene med antall. Brukerens egen vises alltid først,
 * fulgt av opptil tre andre — samme utvalg som gamle Kvark.
 */
export function ReactionChips({
    groups,
    ownEmoji,
    disabled,
    onSelect,
}: ReactionChipsProps) {
    const own = groups.find((group) => group.emoji === ownEmoji);
    const others = groups.filter((group) => group.emoji !== ownEmoji);
    const shown = own
        ? [own, ...others.slice(0, MAX_CHIPS - 1)]
        : others.slice(0, MAX_CHIPS);

    return (
        <>
            {shown.map((group) => (
                <Button
                    key={group.emoji}
                    variant={group.emoji === ownEmoji ? "secondary" : "ghost"}
                    size="sm"
                    disabled={disabled}
                    aria-pressed={group.emoji === ownEmoji}
                    onClick={() => onSelect(group.emoji)}
                >
                    <span>{group.emoji}</span>
                    <span>{group.reactions.length}</span>
                </Button>
            ))}
        </>
    );
}
