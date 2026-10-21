import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@tihlde/ui/ui/alert-dialog";
import {
    Alert,
    AlertAction,
    AlertDescription,
    AlertTitle,
} from "@tihlde/ui/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@tihlde/ui/ui/dialog";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@tihlde/ui/ui/item";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Separator } from "@tihlde/ui/ui/separator";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Switch } from "@tihlde/ui/ui/switch";
import { Textarea } from "@tihlde/ui/ui/textarea";
import type { FeedbackComment, FeedbackItem } from "@photon/codegen";
import {
    Bug,
    ChevronDown,
    Lightbulb,
    MessageCircle,
    Pencil,
    Plus,
    ThumbsDown,
    ThumbsUp,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { authClientWithRedirect, authQueryOptions } from "#/api/auth";
import {
    createFeedbackCommentMutation,
    createFeedbackMutation,
    deleteFeedbackCommentMutation,
    deleteFeedbackMutation,
    deleteFeedbackVoteMutation,
    getFeedbackCommentsQuery,
    getFeedbackInfiniteQuery,
    getFeedbackItemQuery,
    updateFeedbackMutation,
    voteFeedbackMutation,
} from "#/api/queries/feedback";
import { LoadMoreButton } from "#/components/load-more-button";
import { usePermission } from "#/hooks/use-permission";
import { avatarImageUrl } from "#/lib/assets";
import { formatOsloDate } from "#/lib/date";
import { initials } from "#/lib/utils";

const searchSchema = z.object({
    id: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/tilbakemelding")({
    component: FeedbackPage,
    validateSearch: searchSchema,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
});

type FeedbackType = FeedbackItem["type"];
type FeedbackStatus = FeedbackItem["status"];
type TypeFilter = FeedbackType | "all";

const MODERATE_PERMISSIONS = ["feedback:update", "feedback:manage"] as const;
const MANAGE_PERMISSIONS = ["feedback:manage"] as const;
const DELETE_PERMISSIONS = ["feedback:delete", "feedback:manage"] as const;

const STATUS_LABELS: Record<FeedbackStatus, string> = {
    open: "Åpen",
    in_progress: "Under arbeid",
    closed: "Lukket",
    rejected: "Avvist",
};

/**
 * base-ui's Select renders the raw value in the trigger unless it is given the
 * value→label mapping up front — the label only lives inside `SelectItem`,
 * which is not mounted until the popup opens.
 */
const STATUS_ITEMS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
}));

const TYPE_FILTER_ITEMS: Array<{ value: TypeFilter; label: string }> = [
    { value: "all", label: "Alle" },
    { value: "idea", label: "Idéer" },
    { value: "bug", label: "Feil" },
];

const STATUS_VARIANTS: Record<
    FeedbackStatus,
    "default" | "secondary" | "outline" | "destructive"
> = {
    open: "secondary",
    in_progress: "default",
    closed: "outline",
    rejected: "destructive",
};

function formatDate(value: string): string {
    return formatOsloDate(value, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function FeedbackListSkeleton() {
    return (
        <ul className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, index) => (
                <li key={index}>
                    <Skeleton className="h-16 w-full" />
                </li>
            ))}
        </ul>
    );
}

function VoteButtons({ item }: { item: FeedbackItem }) {
    const vote = useMutation(voteFeedbackMutation);
    const removeVote = useMutation(deleteFeedbackVoteMutation);
    const pending = vote.isPending || removeVote.isPending;

    /** Clicking the vote you already hold takes it back — the same button. */
    function cast(value: "up" | "down") {
        if (item.myVote === value) {
            removeVote.mutate({ feedbackId: item.id });
        } else {
            vote.mutate({ feedbackId: item.id, data: { value } });
        }
    }

    return (
        <div className="flex items-center gap-1">
            <Button
                type="button"
                size="sm"
                variant={item.myVote === "up" ? "secondary" : "ghost"}
                disabled={pending}
                aria-pressed={item.myVote === "up"}
                aria-label="Stem opp"
                onClick={() => cast("up")}
            >
                <ThumbsUp />
                {item.upvotes}
            </Button>
            <Button
                type="button"
                size="sm"
                variant={item.myVote === "down" ? "secondary" : "ghost"}
                disabled={pending}
                aria-pressed={item.myVote === "down"}
                aria-label="Stem ned"
                onClick={() => cast("down")}
            >
                <ThumbsDown />
                {item.downvotes}
            </Button>
        </div>
    );
}

function authorLabel(item: FeedbackItem): string {
    if (item.isAuthor) return item.isAnonymous ? "Din · anonym" : "Din";
    return item.author?.name ?? "Anonym";
}

function CommentAuthorAvatar({
    name,
    image,
}: {
    name: string;
    image?: string | null;
}) {
    return (
        <Avatar className="size-8">
            {image ? (
                <AvatarImage src={avatarImageUrl(image)} alt={name} />
            ) : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
    );
}

function CommentRow({
    feedbackId,
    comment,
    canManage,
}: {
    feedbackId: string;
    comment: FeedbackComment;
    canManage: boolean;
}) {
    const remove = useMutation(deleteFeedbackCommentMutation);
    const name =
        comment.author?.name ?? (comment.isFeedbackAuthor ? "Anonym" : "Index");

    return (
        <Item render={<li />} size="flush" className="items-start">
            <ItemMedia>
                <CommentAuthorAvatar
                    name={name}
                    image={comment.author?.image}
                />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>
                    {name}
                    <Badge
                        variant={
                            comment.isFeedbackAuthor ? "outline" : "default"
                        }
                    >
                        {comment.isFeedbackAuthor ? "Innsender" : "Index"}
                    </Badge>
                </ItemTitle>
                <ItemDescription>
                    {formatDate(comment.createdAt)}
                </ItemDescription>
                <p className="whitespace-pre-wrap">{comment.body}</p>
            </ItemContent>
            {comment.isMine || canManage ? (
                <ItemActions>
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Slett kommentar"
                        disabled={remove.isPending}
                        onClick={() =>
                            remove.mutate({
                                feedbackId,
                                commentId: comment.id,
                            })
                        }
                    >
                        <Trash2 />
                    </Button>
                </ItemActions>
            ) : null}
        </Item>
    );
}

function FeedbackComments({
    item,
    canComment,
}: {
    item: FeedbackItem;
    canComment: boolean;
}) {
    const [body, setBody] = useState("");
    const canManage = usePermission(MANAGE_PERMISSIONS);
    const {
        data: comments,
        isPending,
        isError,
        isFetching,
        refetch,
    } = useQuery(getFeedbackCommentsQuery(item.id));
    const create = useMutation(createFeedbackCommentMutation);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        create.mutate(
            { feedbackId: item.id, data: { body } },
            { onSuccess: () => setBody("") },
        );
    }

    if (isPending) return <Skeleton className="h-12 w-full" />;

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Kunne ikke hente kommentarene</AlertTitle>
                <AlertAction>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isFetching}
                        onClick={() => refetch()}
                    >
                        Prøv igjen
                    </Button>
                </AlertAction>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {comments && comments.length > 0 ? (
                <ul className="flex flex-col gap-4">
                    {comments.map((comment) => (
                        <CommentRow
                            key={comment.id}
                            feedbackId={item.id}
                            comment={comment}
                            canManage={canManage}
                        />
                    ))}
                </ul>
            ) : null}

            {canComment ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    <Textarea
                        aria-label={item.isAuthor ? "Svar" : "Kommentar"}
                        required
                        maxLength={2000}
                        rows={2}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={
                            item.isAuthor
                                ? "Svar Index..."
                                : "Svar innsenderen..."
                        }
                    />
                    {create.isError ? (
                        <FieldError>
                            Kunne ikke sende kommentaren. Prøv igjen.
                        </FieldError>
                    ) : null}
                    <Button
                        type="submit"
                        size="sm"
                        className="self-end"
                        disabled={create.isPending || body.trim().length === 0}
                    >
                        {create.isPending ? "Sender..." : "Send"}
                    </Button>
                </form>
            ) : null}
        </div>
    );
}

function RejectDialog({
    item,
    open,
    onOpenChange,
}: {
    item: FeedbackItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [reason, setReason] = useState(item.rejectionReason ?? "");
    const [wasOpen, setWasOpen] = useState(open);
    const update = useMutation(updateFeedbackMutation);

    // Opened from a button, not from the dialog itself, so the form is
    // refilled here: otherwise "Endre" shows whatever it held when mounted.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setReason(item.rejectionReason ?? "");
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        update.mutate(
            {
                feedbackId: item.id,
                data: {
                    status: "rejected",
                    rejectionReason: reason.trim() || null,
                },
            },
            { onSuccess: () => onOpenChange(false) },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>Avvis «{item.title}»</DialogTitle>
                        <DialogDescription>
                            Grunnen vises for alle, og innsenderen får beskjed.
                        </DialogDescription>
                    </DialogHeader>

                    <Field>
                        <FieldLabel htmlFor={`rejection-reason-${item.id}`}>
                            Grunn (valgfritt)
                        </FieldLabel>
                        <Textarea
                            id={`rejection-reason-${item.id}`}
                            maxLength={1000}
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Hvorfor blir dette ikke gjort?"
                        />
                    </Field>

                    {update.isError ? (
                        <FieldError>Kunne ikke avvise. Prøv igjen.</FieldError>
                    ) : null}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={update.isPending}
                        >
                            {item.status === "rejected" ? "Lagre" : "Avvis"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FeedbackRow({
    item,
    defaultOpen = false,
}: {
    item: FeedbackItem;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const canModerate = usePermission(MODERATE_PERMISSIONS);
    const mayDeleteAny = usePermission(DELETE_PERMISSIONS);
    const canDelete = mayDeleteAny || item.isEditable;

    const remove = useMutation(deleteFeedbackMutation);
    const update = useMutation(updateFeedbackMutation);

    return (
        <Collapsible open={open} onOpenChange={setOpen} bordered>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <span className="flex min-w-0 items-center gap-3">
                    {item.type === "bug" ? (
                        <Bug className="size-5 shrink-0 text-destructive" />
                    ) : (
                        <Lightbulb className="size-5 shrink-0 text-yellow-500" />
                    )}
                    <span className="truncate font-medium">{item.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    {item.commentCount > 0 ? (
                        <Badge
                            variant="outline"
                            aria-label={`${item.commentCount} kommentarer`}
                        >
                            <MessageCircle />
                            {item.commentCount}
                        </Badge>
                    ) : null}
                    <Badge variant={STATUS_VARIANTS[item.status]}>
                        {STATUS_LABELS[item.status]}
                    </Badge>
                    <ChevronDown
                        className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </CollapsibleTrigger>

            <CollapsibleContent divided className="p-4">
                <p className="whitespace-pre-wrap text-muted-foreground">
                    {item.description}
                </p>

                {item.status === "rejected" &&
                (item.rejectionReason || canModerate) ? (
                    <Alert variant="destructive" className="mt-4">
                        <AlertTitle>Grunn til avvisning</AlertTitle>
                        <AlertDescription className="whitespace-pre-wrap">
                            {item.rejectionReason ?? "Ingen grunn oppgitt."}
                        </AlertDescription>
                        {canModerate ? (
                            <AlertAction>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRejectOpen(true)}
                                >
                                    {item.rejectionReason
                                        ? "Endre"
                                        : "Legg til"}
                                </Button>
                            </AlertAction>
                        ) : null}
                    </Alert>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {authorLabel(item)} · {formatDate(item.createdAt)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <VoteButtons item={item} />

                        {item.isEditable ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditOpen(true)}
                            >
                                <Pencil />
                                Rediger
                            </Button>
                        ) : null}

                        {canModerate && (
                            <Select
                                items={STATUS_ITEMS}
                                value={item.status}
                                onValueChange={(status) => {
                                    if (status === "rejected") {
                                        setRejectOpen(true);
                                        return;
                                    }
                                    update.mutate({
                                        feedbackId: item.id,
                                        data: {
                                            status: status as FeedbackStatus,
                                        },
                                    });
                                }}
                            >
                                <SelectTrigger size="sm" className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_ITEMS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger
                                    render={
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            disabled={remove.isPending}
                                        >
                                            <Trash2 />
                                            Slett
                                        </Button>
                                    }
                                />
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Er du sikker?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            «{item.title}» blir borte for alle,
                                            sammen med stemmene den har fått.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel
                                            variant="outline"
                                            size="default"
                                        >
                                            Avbryt
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            variant="destructive"
                                            onClick={() =>
                                                remove.mutate({
                                                    feedbackId: item.id,
                                                })
                                            }
                                        >
                                            Slett
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>

                <FeedbackFormDialog
                    type={item.type}
                    item={item}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />

                <RejectDialog
                    item={item}
                    open={rejectOpen}
                    onOpenChange={setRejectOpen}
                />

                <Separator className="my-4" />
                <FeedbackComments
                    item={item}
                    canComment={canModerate || item.isAuthor}
                />
            </CollapsibleContent>
        </Collapsible>
    );
}

function FeedbackFormDialog({
    type,
    item,
    open,
    onOpenChange,
}: {
    type: FeedbackType;
    item?: FeedbackItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [title, setTitle] = useState(item?.title ?? "");
    const [description, setDescription] = useState(item?.description ?? "");
    const [isAnonymous, setIsAnonymous] = useState(item?.isAnonymous ?? true);
    const [error, setError] = useState<string | null>(null);
    const [wasOpen, setWasOpen] = useState(open);

    const create = useMutation(createFeedbackMutation);
    const update = useMutation(updateFeedbackMutation);
    const isPending = create.isPending || update.isPending;
    const isBug = type === "bug";

    function reset() {
        setTitle(item?.title ?? "");
        setDescription(item?.description ?? "");
        setIsAnonymous(item?.isAnonymous ?? true);
        setError(null);
    }

    // Refill on every open: the edit dialog stays mounted, so its first
    // values would otherwise be saved back over a later edit.
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) reset();
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            if (item) {
                await update.mutateAsync({
                    feedbackId: item.id,
                    data: { title, description, isAnonymous },
                });
            } else {
                await create.mutateAsync({
                    data: { type, title, description, isAnonymous },
                });
            }
            onOpenChange(false);
        } catch {
            setError(
                item
                    ? "Kunne ikke lagre. Har noen andre stemt eller svart, kan den ikke endres lenger."
                    : isBug
                      ? "Kunne ikke sende inn feilen. Prøv igjen."
                      : "Kunne ikke sende inn idéen. Prøv igjen.",
            );
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {item
                                ? "Rediger"
                                : isBug
                                  ? "Meld en feil"
                                  : "Ny idé"}
                        </DialogTitle>
                        <DialogDescription>
                            {item
                                ? "Du kan endre den til noen andre har stemt eller svart."
                                : isBug
                                  ? "Fortell hva som ikke virker, så ser Index på det."
                                  : "Foreslå noe du vil ha på nettsiden."}
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="feedback-title">
                                Tittel
                            </FieldLabel>
                            <Input
                                id="feedback-title"
                                required
                                minLength={2}
                                maxLength={100}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={
                                    isBug ? "Kort om feilen" : "Kort om idéen"
                                }
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="feedback-description">
                                Beskrivelse
                            </FieldLabel>
                            <Textarea
                                id="feedback-description"
                                required
                                minLength={10}
                                maxLength={2000}
                                rows={5}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Skriv her..."
                            />
                            <FieldDescription>
                                {isBug
                                    ? "Hvor skjedde det, og hva gjorde du rett før?"
                                    : "Hva ønsker du, og hvorfor?"}
                            </FieldDescription>
                        </Field>
                        <Field orientation="horizontal">
                            <FieldContent>
                                <FieldLabel htmlFor="feedback-anonymous">
                                    Anonym
                                </FieldLabel>
                                <FieldDescription>
                                    Viser du navnet ditt, kan Index spørre deg
                                    om detaljer og fikse problemet raskere.
                                </FieldDescription>
                            </FieldContent>
                            <Switch
                                id="feedback-anonymous"
                                checked={isAnonymous}
                                onCheckedChange={setIsAnonymous}
                            />
                        </Field>
                    </FieldGroup>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Avbryt
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending
                                ? "Sender..."
                                : item
                                  ? "Lagre"
                                  : "Send inn"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FeedbackPage() {
    const { id: linkedId } = Route.useSearch();
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [dialogType, setDialogType] = useState<FeedbackType | null>(null);

    // Keeps the session warm for the permission hooks the rows use.
    useQuery(authQueryOptions);

    const { data, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useInfiniteQuery(
            getFeedbackInfiniteQuery(
                typeFilter === "all" ? {} : { type: typeFilter },
            ),
        );

    const linked = useQuery({
        ...getFeedbackItemQuery(linkedId ?? ""),
        enabled: linkedId !== undefined,
        // A deleted item answers 404; retrying would only hold the skeleton
        // for several seconds before saying so.
        retry: false,
    });

    const linkedItem = linked.data;
    const items = (data?.pages.flatMap((page) => page.items) ?? []).filter(
        (item) => item.id !== linkedItem?.id,
    );

    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl">Tilbakemelding</h1>
                    <p className="text-muted-foreground">
                        Foreslå noe nytt eller meld en feil på nettsiden. Stem
                        på det du vil at Index skal ta først.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogType("idea")}
                    >
                        <Plus />
                        Ny idé
                    </Button>
                    <Button type="button" onClick={() => setDialogType("bug")}>
                        <Plus />
                        Meld feil
                    </Button>
                </div>
            </div>

            <Select
                items={TYPE_FILTER_ITEMS}
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as TypeFilter)}
            >
                <SelectTrigger className="w-48">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {TYPE_FILTER_ITEMS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {linkedId !== undefined && linked.isPending ? (
                <Skeleton className="h-16 w-full" />
            ) : null}

            {linked.isError ? (
                <Alert>
                    <AlertTitle>Fant ikke tilbakemeldingen</AlertTitle>
                    <AlertDescription>
                        Den kan ha blitt slettet.
                    </AlertDescription>
                </Alert>
            ) : null}

            {linkedItem ? (
                <FeedbackRow
                    key={linkedItem.id}
                    item={linkedItem}
                    defaultOpen
                />
            ) : null}

            {isPending ? (
                <FeedbackListSkeleton />
            ) : items.length > 0 || linkedItem ? (
                <ul className="flex flex-col gap-3">
                    {items.map((item) => (
                        <li key={item.id}>
                            <FeedbackRow item={item} />
                        </li>
                    ))}
                    {hasNextPage ? (
                        <li className="flex justify-center">
                            <LoadMoreButton
                                onClick={() => fetchNextPage()}
                                isLoading={isFetchingNextPage}
                            />
                        </li>
                    ) : null}
                </ul>
            ) : (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Bug />
                        </EmptyMedia>
                        <EmptyTitle>Ingen tilbakemeldinger ennå</EmptyTitle>
                        <EmptyDescription>
                            Har du en idé eller funnet en feil? Send den inn.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}

            <FeedbackFormDialog
                type={dialogType ?? "idea"}
                open={dialogType !== null}
                onOpenChange={(next) => setDialogType(next ? dialogType : null)}
            />
        </div>
    );
}
