import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Progress } from "@tihlde/ui/ui/progress";
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    QrCode,
    Users,
    UsersRound,
} from "lucide-react";

import type { ReactNode } from "react";

import type { EventItem, EventRegistrationState } from "#/data/events";

type EventRegistrationCardProps = Pick<
    EventItem,
    | "registrationState"
    | "registrationOpensAt"
    | "registrationOpensInLabel"
    | "capacity"
    | "registeredCount"
    | "waitlistCount"
    | "isAdmin"
> & {
    onRegister?: () => void;
    onUnregister?: () => void;
    onShowRegistrants?: () => void;
    onNotify?: () => void;
    qrSlot?: ReactNode;
};

export function EventRegistrationCard(props: EventRegistrationCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Påmelding</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {renderState(props)}
            </CardContent>
        </Card>
    );
}

function renderState(props: EventRegistrationCardProps) {
    const state: EventRegistrationState = props.registrationState;

    if (state === "not-open") {
        return (
            <>
                <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                        <span>
                            Påmelding åpner om{" "}
                            {props.registrationOpensInLabel ?? "en stund"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            Start: {props.registrationOpensAt}
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={props.onNotify}
                >
                    <CalendarClock />
                    Varsle meg
                </Button>
            </>
        );
    }

    if (state === "joined") {
        return (
            <>
                <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4" />
                    <div className="flex flex-col">
                        <span>Du har plass på arrangementet!</span>
                        <span className="text-sm text-muted-foreground">
                            Vi gleder oss til å se deg
                        </span>
                    </div>
                </div>
                {props.qrSlot ?? (
                    <Button className="w-full">
                        <QrCode />
                        Påmeldingsbevis
                    </Button>
                )}
                <Button
                    variant="destructive"
                    className="w-full"
                    onClick={props.onUnregister}
                >
                    Meld deg av
                </Button>
                <RegistrationStats {...props} />
            </>
        );
    }

    return (
        <>
            <RegistrationStats {...props} />
            <Button className="w-full" onClick={props.onRegister}>
                Meld deg på
            </Button>
        </>
    );
}

function RegistrationStats({
    capacity,
    registeredCount,
    waitlistCount,
    isAdmin,
    onShowRegistrants,
}: EventRegistrationCardProps) {
    const capacityLabel = capacity === null ? "∞" : String(capacity);
    const progress =
        capacity === null || capacity === 0
            ? null
            : Math.min(100, Math.round((registeredCount / capacity) * 100));

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <span>Påmeldte</span>
                </span>
                <div className="flex items-center gap-1">
                    <span className="tabular-nums">
                        {registeredCount}/{capacityLabel}
                    </span>
                    {isAdmin ? (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onShowRegistrants}
                            aria-label="Se påmeldte"
                        >
                            <UsersRound />
                        </Button>
                    ) : null}
                </div>
            </div>
            {progress !== null ? <Progress value={progress} /> : null}
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                    <UsersRound className="size-4 text-muted-foreground" />
                    <span>Venteliste</span>
                </span>
                <span className="tabular-nums">{waitlistCount}</span>
            </div>
        </div>
    );
}
