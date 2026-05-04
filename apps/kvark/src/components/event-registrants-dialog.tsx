import { Avatar, AvatarFallback } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
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

import type { EventRegistrant } from "#/mock/events";

type EventRegistrantsDialogProps = {
    trigger: ReactElement;
    title: string;
    registrants: EventRegistrant[];
};

export function EventRegistrantsDialog({
    trigger,
    title,
    registrants,
}: EventRegistrantsDialogProps) {
    const registered = registrants.filter((r) => !r.onWaitlist);
    const waitlist = registrants.filter((r) => r.onWaitlist);

    return (
        <Dialog>
            <DialogTrigger render={trigger} />
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Påmeldte til {title}</DialogTitle>
                    <DialogDescription>
                        {registered.length} påmeldte · {waitlist.length} på
                        venteliste
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
    const initials = registrant.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("");

    return (
        <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{registrant.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {registrant.studyProgram} · {registrant.classYear}. klasse
                </span>
            </div>
            {waitlist ? <Badge variant="secondary">Venteliste</Badge> : null}
        </div>
    );
}
