import { useMutation, useQuery } from "@tanstack/react-query";
import type { Event } from "@tihlde/sdk";
import { FieldError } from "@tihlde/ui/ui/field";
import { useMemo, useState } from "react";

import { authQueryOptions } from "#/api/auth";
import {
    createEventReactionMutation,
    deleteEventReactionMutation,
} from "#/api/queries/events";
import { useTheme } from "#/integrations/theme";

import { groupReactions } from "./group-reactions";
import { ReactionChips } from "./reaction-chips";
import { ReactionListDialog } from "./reaction-list-dialog";
import { ReactionPickerDialog } from "./reaction-picker-dialog";

type EventReactionsProps = {
    event: Pick<Event, "id" | "reactions">;
};

/**
 * Emoji-reaksjonene på et arrangement. En container: den eier innlogget
 * bruker, mutasjonene og feilteksten, og gir resten videre til de dumme
 * delene ved siden av.
 *
 * Hver bruker har én reaksjon per arrangement. Trykk på din egen fjerner
 * den; en hvilken som helst annen gjør den til din (API-et erstatter en
 * eksisterende).
 */
export function EventReactions({ event }: EventReactionsProps) {
    const { data: session } = useQuery(authQueryOptions);
    const { theme } = useTheme();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createReaction = useMutation(createEventReactionMutation);
    const deleteReaction = useMutation(deleteEventReactionMutation);
    const pending = createReaction.isPending || deleteReaction.isPending;

    const userId = session?.user?.id;
    const ownEmoji =
        event.reactions.find((reaction) => reaction.user.id === userId)
            ?.emoji ?? null;
    const groups = useMemo(
        () => groupReactions(event.reactions),
        [event.reactions],
    );

    function onError(err: Error) {
        setError(err.message);
    }

    function react(emoji: string, options?: { onSettled?: () => void }) {
        if (pending) return;
        setError(null);
        createReaction.mutate(
            { eventId: event.id, data: { emoji } },
            { onError, onSettled: options?.onSettled },
        );
    }

    function selectChip(emoji: string) {
        if (pending) return;
        if (emoji === ownEmoji) {
            setError(null);
            deleteReaction.mutate({ eventId: event.id }, { onError });
            return;
        }
        react(emoji);
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center gap-1">
                <ReactionChips
                    groups={groups}
                    ownEmoji={ownEmoji}
                    disabled={pending}
                    onSelect={selectChip}
                />
                <ReactionPickerDialog
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    theme={theme}
                    disabled={pending}
                    onPick={(emoji) =>
                        react(emoji, {
                            onSettled: () => setPickerOpen(false),
                        })
                    }
                />
                <ReactionListDialog
                    reactions={event.reactions}
                    groups={groups}
                />
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
        </div>
    );
}
