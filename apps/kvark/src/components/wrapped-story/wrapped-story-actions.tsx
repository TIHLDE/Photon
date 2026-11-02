import { StoryActionButton, StoryActions } from "@tihlde/ui/ui/story-viewer";
import { Heart, MessageCircle } from "lucide-react";

type WrappedStoryActionsProps = {
    likeCount: number;
    likedByMe: boolean;
    commentCount: number;
    onToggleLike: () => void;
    onOpenComments: () => void;
};

/** Lik og kommentar til høyre på et bilde i storyen. */
export function WrappedStoryActions({
    likeCount,
    likedByMe,
    commentCount,
    onToggleLike,
    onOpenComments,
}: WrappedStoryActionsProps) {
    return (
        <StoryActions>
            <StoryActionButton
                aria-pressed={likedByMe}
                aria-label={likedByMe ? "Fjern liken" : "Lik bildet"}
                count={likeCount}
                onClick={onToggleLike}
            >
                <Heart />
            </StoryActionButton>
            <StoryActionButton
                aria-label={`Kommentarer (${commentCount})`}
                count={commentCount}
                onClick={onOpenComments}
            >
                <MessageCircle />
            </StoryActionButton>
        </StoryActions>
    );
}
