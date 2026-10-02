import type { Event } from "@tihlde/sdk";

export type EventReactionItem = Event["reactions"][number];

export type ReactionGroup = {
    emoji: string;
    reactions: EventReactionItem[];
};

/** Reaksjonene gruppert per emoji, flest først. */
export function groupReactions(
    reactions: EventReactionItem[],
): ReactionGroup[] {
    const groups = new Map<string, EventReactionItem[]>();
    for (const reaction of reactions) {
        const group = groups.get(reaction.emoji);
        if (group) {
            group.push(reaction);
        } else {
            groups.set(reaction.emoji, [reaction]);
        }
    }

    return [...groups.entries()]
        .map(([emoji, reactions]) => ({ emoji, reactions }))
        .sort((a, b) => b.reactions.length - a.reactions.length);
}
