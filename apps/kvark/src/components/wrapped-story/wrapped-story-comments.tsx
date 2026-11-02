import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Button } from "@tihlde/ui/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@tihlde/ui/ui/drawer";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { SendHorizontal, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

export const WRAPPED_COMMENT_MAX_LENGTH = 500;

export type WrappedStoryCommentData = {
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorImage: string | null;
    canDelete: boolean;
};

type WrappedStoryCommentsProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `undefined` mens kommentarene hentes. */
    comments: WrappedStoryCommentData[] | undefined;
    totalCount: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    isSubmitting: boolean;
    error: string | null;
    onLoadMore: () => void;
    /** Kalles med teksten; svarer `true` når kommentaren er lagret. */
    onSubmit: (body: string) => Promise<boolean>;
    onDelete: (commentId: string) => void;
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

/** Kommentarene på et bilde i storyen, i et ark nedenfra. */
export function WrappedStoryComments({
    open,
    onOpenChange,
    comments,
    totalCount,
    hasMore,
    isLoadingMore,
    isSubmitting,
    error,
    onLoadMore,
    onSubmit,
    onDelete,
}: WrappedStoryCommentsProps) {
    const [draft, setDraft] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const trimmed = draft.trim();

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!trimmed || isSubmitting) return;
        if (await onSubmit(trimmed)) setDraft("");
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>Kommentarer</DrawerTitle>
                    <DrawerDescription>
                        {totalCount === 0
                            ? "Ingen kommentarer ennå. Bli den første!"
                            : totalCount === 1
                              ? "1 kommentar"
                              : `${totalCount} kommentarer`}
                    </DrawerDescription>
                </DrawerHeader>
                <ul className="flex flex-col gap-4 overflow-y-auto px-4">
                    {comments === undefined
                        ? [0, 1, 2].map((i) => (
                              <li key={i} className="flex gap-3">
                                  <Skeleton className="size-8" />
                                  <div className="flex flex-1 flex-col gap-2">
                                      <Skeleton className="h-3 w-24" />
                                      <Skeleton className="h-4 w-full" />
                                  </div>
                              </li>
                          ))
                        : comments.map((comment) => (
                              <li key={comment.id} className="flex gap-3">
                                  <Avatar>
                                      {comment.authorImage ? (
                                          <AvatarImage
                                              src={comment.authorImage}
                                              alt=""
                                          />
                                      ) : null}
                                      <AvatarFallback>
                                          {initials(comment.authorName)}
                                      </AvatarFallback>
                                  </Avatar>
                                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                                      <p className="text-xs text-muted-foreground">
                                          <span className="font-semibold text-foreground">
                                              {comment.authorName}
                                          </span>
                                          {" · "}
                                          {formatDistanceToNow(
                                              new Date(comment.createdAt),
                                              { locale: nb, addSuffix: true },
                                          )}
                                      </p>
                                      <p className="text-sm break-words whitespace-pre-line">
                                          {comment.body}
                                      </p>
                                  </div>
                                  {comment.canDelete ? (
                                      confirmDelete === comment.id ? (
                                          <Button
                                              variant="destructive"
                                              size="sm"
                                              onClick={() => {
                                                  setConfirmDelete(null);
                                                  onDelete(comment.id);
                                              }}
                                          >
                                              Slett
                                          </Button>
                                      ) : (
                                          <Button
                                              variant="ghost"
                                              size="icon"
                                              aria-label="Slett kommentaren"
                                              onClick={() =>
                                                  setConfirmDelete(comment.id)
                                              }
                                          >
                                              <Trash2 />
                                          </Button>
                                      )
                                  ) : null}
                              </li>
                          ))}
                    {hasMore ? (
                        <li className="flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isLoadingMore}
                                onClick={onLoadMore}
                            >
                                Vis flere
                            </Button>
                        </li>
                    ) : null}
                </ul>
                <DrawerFooter>
                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                    <form className="flex items-end gap-2" onSubmit={submit}>
                        <Textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Skriv en kommentar …"
                            aria-label="Kommentar"
                            maxLength={WRAPPED_COMMENT_MAX_LENGTH}
                            rows={1}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            aria-label="Send kommentaren"
                            disabled={!trimmed || isSubmitting}
                        >
                            <SendHorizontal />
                        </Button>
                    </form>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
