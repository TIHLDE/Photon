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
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Textarea } from "@tihlde/ui/ui/textarea";
import type { FeedbackItem } from "@tihlde/sdk";
import {
    Bug,
    ChevronDown,
    Lightbulb,
    Plus,
    ThumbsDown,
    ThumbsUp,
    Trash2,
} from "lucide-react";
import { useState } from "react";

import { authClientWithRedirect, authQueryOptions } from "#/api/auth";
import {
    createFeedbackMutation,
    deleteFeedbackMutation,
    deleteFeedbackVoteMutation,
    getFeedbackInfiniteQuery,
    updateFeedbackMutation,
    voteFeedbackMutation,
} from "#/api/queries/feedback";
import { LoadMoreButton } from "#/components/load-more-button";
import { usePermission } from "#/hooks/use-permission";
import { formatOsloDate } from "#/lib/date";

export const Route = createFileRoute("/_app/tilbakemelding")({
    component: FeedbackPage,
    beforeLoad: ({ location }) => authClientWithRedirect(location.href),
});

type FeedbackType = FeedbackItem["type"];
type FeedbackStatus = FeedbackItem["status"];
type TypeFilter = FeedbackType | "all";

const MODERATE_PERMISSIONS = ["feedback:update", "feedback:manage"] as const;

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

function FeedbackRow({ item }: { item: FeedbackItem }) {
    const [open, setOpen] = useState(false);
    const canModerate = usePermission(MODERATE_PERMISSIONS);
    // Feedback is anonymous, so there is no author id to compare against —
    // the API tells us whether this row is ours.
    const canDelete = canModerate || item.isAuthor;

    const remove = useMutation(deleteFeedbackMutation);
    const update = useMutation(updateFeedbackMutation);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="rounded-lg border"
        >
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
                    <Badge variant={STATUS_VARIANTS[item.status]}>
                        {STATUS_LABELS[item.status]}
                    </Badge>
                    <ChevronDown
                        className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t p-4">
                <p className="whitespace-pre-wrap text-muted-foreground">
                    {item.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {item.isAuthor ? "Din" : "Anonym"} ·{" "}
                        {formatDate(item.createdAt)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <VoteButtons item={item} />

                        {canModerate && (
                            <Select
                                items={STATUS_ITEMS}
                                value={item.status}
                                onValueChange={(status) =>
                                    update.mutate({
                                        feedbackId: item.id,
                                        data: {
                                            status: status as FeedbackStatus,
                                        },
                                    })
                                }
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
            </CollapsibleContent>
        </Collapsible>
    );
}

function CreateFeedbackDialog({
    type,
    open,
    onOpenChange,
}: {
    type: FeedbackType;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);

    const create = useMutation(createFeedbackMutation);
    const isBug = type === "bug";

    function reset() {
        setTitle("");
        setDescription("");
        setError(null);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            await create.mutateAsync({ data: { type, title, description } });
            reset();
            onOpenChange(false);
        } catch {
            setError(
                isBug
                    ? "Kunne ikke sende inn feilen. Prøv igjen."
                    : "Kunne ikke sende inn idéen. Prøv igjen.",
            );
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {isBug ? "Meld en feil" : "Ny idé"}
                        </DialogTitle>
                        <DialogDescription>
                            {isBug
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
                        <Button type="submit" disabled={create.isPending}>
                            {create.isPending ? "Sender..." : "Send inn"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FeedbackPage() {
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

    const items = data?.pages.flatMap((page) => page.items) ?? [];

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

            {isPending ? (
                <FeedbackListSkeleton />
            ) : items.length > 0 ? (
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

            <CreateFeedbackDialog
                type={dialogType ?? "idea"}
                open={dialogType !== null}
                onOpenChange={(next) => setDialogType(next ? dialogType : null)}
            />
        </div>
    );
}
