import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import { ScrollArea } from "@tihlde/ui/ui/scroll-area";
import type { ReactElement } from "react";

import { avatarImageUrl } from "#/lib/assets";
import type { EventRegistrant } from "#/lib/event";
import { initials } from "#/lib/utils";

type EventRegistrantsDialogProps = {
    trigger: ReactElement;
    title: string;
    registrants: EventRegistrant[];
    /** Antall påmeldte totalt, når lista er lastet side for side. */
    totalCount?: number;
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
};

export function EventRegistrantsDialog({
    trigger,
    title,
    registrants,
    totalCount,
    hasMore,
    isLoadingMore,
    onLoadMore,
}: EventRegistrantsDialogProps) {
    const registered = registrants.filter((r) => !r.onWaitlist);
    const waitlist = registrants.filter((r) => r.onWaitlist);
    // Med paginering er `registered.length` bare det som er lastet så langt.
    const registeredCount = totalCount ?? registered.length;

    return (
        <Dialog>
            <DialogTrigger render={trigger} />
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Påmeldte til {title}</DialogTitle>
                    <DialogDescription>
                        {waitlist.length > 0
                            ? `${registeredCount} påmeldte · ${waitlist.length} på venteliste`
                            : `${registeredCount} påmeldte`}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-96">
                    <div className="flex flex-col gap-1">
                        {registered.map((r) => (
                            <RegistrantRow key={r.id} registrant={r} />
                        ))}

                        {waitlist.length > 0 ? (
                            <>
                                <div className="px-2 pt-3 pb-1 text-xs text-muted-foreground">
                                    Venteliste
                                </div>
                                {waitlist.map((r) => (
                                    <RegistrantRow
                                        key={r.id}
                                        registrant={r}
                                        waitlist
                                    />
                                ))}
                            </>
                        ) : null}

                        {registrants.length === 0 ? (
                            <p className="p-2 text-sm text-muted-foreground">
                                Ingen er påmeldt ennå.
                            </p>
                        ) : null}

                        {hasMore ? (
                            <Button
                                variant="ghost"
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore
                                    ? "Laster …"
                                    : "Vis flere påmeldte"}
                            </Button>
                        ) : null}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function RegistrantRow({
    registrant,
    waitlist,
}: {
    registrant: EventRegistrant;
    waitlist?: boolean;
}) {
    const content = (
        <>
            <Avatar>
                {registrant.image ? (
                    <AvatarImage
                        src={avatarImageUrl(registrant.image)}
                        alt={registrant.name}
                    />
                ) : null}
                <AvatarFallback>{initials(registrant.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{registrant.name}</span>
                {registrant.studyProgram || registrant.classYear ? (
                    <span className="truncate text-xs text-muted-foreground">
                        {[
                            registrant.studyProgram,
                            registrant.classYear
                                ? `${registrant.classYear}. klasse`
                                : null,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                ) : null}
            </div>
            {registrant.allowPhoto === false ? (
                <Badge variant="outline">Ikke foto</Badge>
            ) : null}
            {waitlist ? <Badge variant="secondary">Venteliste</Badge> : null}
        </>
    );

    // Anonymiserte rader har ingen id å lenke til — der bærer verken navnet
    // eller bildet en identitet.
    if (registrant.isAnonymous) {
        return <div className="flex items-center gap-3 p-2">{content}</div>;
    }

    return (
        <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 p-2 text-left"
            render={<Link to="/profil/$id" params={{ id: registrant.id }} />}
        >
            {content}
        </Button>
    );
}
