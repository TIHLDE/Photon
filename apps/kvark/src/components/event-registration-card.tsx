import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Progress } from "@tihlde/ui/ui/progress";
import {
    AlertCircle,
    Ban,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Hourglass,
    Lock,
    QrCode,
    Tag,
    Users,
    type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type {
    EventDeadline,
    EventPrice,
    EventRegistrationState,
} from "#/mock/events";

type EventRegistrationCardProps = {
    registrationState: EventRegistrationState;
    registrationOpensAt?: EventDeadline;
    registrationOpensInLabel?: string;
    registrationClosesAt?: EventDeadline;
    unregisterDeadline?: EventDeadline;
    paymentDeadline?: EventDeadline;
    capacity: number | null;
    registeredCount: number;
    waitlistCount: number;
    isAdmin: boolean;
    price: EventPrice;
    onRegister?: () => void;
    onUnregister?: () => void;
    onJoinWaitlist?: () => void;
    onNotify?: () => void;
    onPay?: () => void;
    qrSlot?: ReactNode;
    headerSlot?: ReactNode;
    notEligibleReason?: string;
    waitlistPosition?: number;
};

export function EventRegistrationCard(props: EventRegistrationCardProps) {
    const timeline = buildTimeline(props);
    const state = getStateRendering(props);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle>Påmelding</CardTitle>
                <div className="flex items-center gap-2">
                    {props.price.kind === "paid" ? (
                        <Badge variant="secondary">
                            <Tag />
                            {props.price.label}
                        </Badge>
                    ) : null}
                    {props.headerSlot}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {timeline.length >= 2 ? (
                    <RegistrationTimeline points={timeline} />
                ) : null}
                <RegistrationStats {...props} />
                {state.message ? (
                    <InfoRow icon={state.icon}>
                        <span>{state.message}</span>
                        {state.secondary ? (
                            <span className="text-sm text-muted-foreground">
                                {state.secondary}
                            </span>
                        ) : null}
                    </InfoRow>
                ) : null}
                {state.actions}
            </CardContent>
        </Card>
    );
}

type StateRendering = {
    icon?: LucideIcon;
    message?: ReactNode;
    secondary?: ReactNode;
    actions?: ReactNode;
};

function getStateRendering(props: EventRegistrationCardProps): StateRendering {
    const state = props.registrationState;

    switch (state) {
        case "not-open":
            return {
                icon: AlertCircle,
                message: `Påmelding åpner om ${props.registrationOpensInLabel ?? "en stund"}`,
                actions: (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={props.onNotify}
                    >
                        <CalendarClock />
                        Varsle meg
                    </Button>
                ),
            };

        case "joined":
            return {
                icon: CheckCircle2,
                message: "Du har plass på arrangementet!",
                actions: (
                    <>
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
                    </>
                ),
            };

        case "awaiting-payment":
            return {
                icon: CreditCard,
                message: "Plass reservert — venter på betaling",
                secondary: props.paymentDeadline
                    ? `Betal innen ${props.paymentDeadline.day} kl. ${props.paymentDeadline.time}`
                    : null,
                actions: (
                    <>
                        <Button className="w-full" onClick={props.onPay}>
                            <CreditCard />
                            Betal nå
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={props.onUnregister}
                        >
                            Meld deg av
                        </Button>
                    </>
                ),
            };

        case "on-waitlist":
            return {
                icon: Hourglass,
                message: "Du er på venteliste",
                secondary: props.waitlistPosition
                    ? `Posisjon ${props.waitlistPosition}`
                    : null,
                actions: (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={props.onUnregister}
                    >
                        Forlat venteliste
                    </Button>
                ),
            };

        case "closed":
            return {
                icon: Lock,
                message: "Påmelding er stengt",
            };

        case "full":
            return {
                icon: AlertCircle,
                message: "Arrangementet er fullt",
                actions: (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={props.onJoinWaitlist}
                    >
                        Sett meg på venteliste
                    </Button>
                ),
            };

        case "not-eligible":
            return {
                icon: Ban,
                message: "Du kan ikke melde deg på",
                secondary:
                    props.notEligibleReason ??
                    "Dette arrangementet er ikke åpent for deg basert på årstrinn eller undergruppe.",
            };

        case "open":
            return {
                actions: (
                    <Button className="w-full" onClick={props.onRegister}>
                        Meld deg på
                    </Button>
                ),
            };

        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}

type TimelinePoint = {
    label: string;
    day: string;
    time: string;
};

function buildTimeline(props: EventRegistrationCardProps): TimelinePoint[] {
    const points: TimelinePoint[] = [];
    if (props.registrationOpensAt) {
        points.push({
            label: props.registrationState === "not-open" ? "Åpner" : "Åpnet",
            ...props.registrationOpensAt,
        });
    }
    const showUnregister =
        props.registrationState === "joined" ||
        props.registrationState === "awaiting-payment";
    if (showUnregister && props.unregisterDeadline) {
        points.push({
            label: "Avmelding",
            ...props.unregisterDeadline,
        });
    }
    if (props.registrationClosesAt) {
        points.push({
            label: props.registrationState === "closed" ? "Lukket" : "Lukker",
            ...props.registrationClosesAt,
        });
    }
    return points;
}

function RegistrationTimeline({ points }: { points: TimelinePoint[] }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            {points.map((point, i) => (
                <Fragment key={point.label}>
                    {i > 0 ? <div className="h-px flex-1 bg-border" /> : null}
                    <div className="flex shrink-0 flex-col gap-0.5">
                        <span>{point.label}</span>
                        <span className="text-muted-foreground">
                            {point.day}
                        </span>
                        <span className="text-muted-foreground">
                            kl. {point.time}
                        </span>
                    </div>
                </Fragment>
            ))}
        </div>
    );
}

function RegistrationStats({
    capacity,
    registeredCount,
    waitlistCount,
}: EventRegistrationCardProps) {
    const capacityLabel = capacity === null ? "∞" : String(capacity);
    const progress =
        capacity === null || capacity === 0
            ? null
            : Math.min(100, Math.round((registeredCount / capacity) * 100));

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span className="tabular-nums">
                    {registeredCount}/{capacityLabel} påmeldte
                </span>
                {waitlistCount > 0 ? (
                    <span className="text-muted-foreground">
                        · {waitlistCount} venteliste
                    </span>
                ) : null}
            </div>
            {progress !== null ? <Progress value={progress} /> : null}
        </div>
    );
}

function InfoRow({
    icon: Icon,
    children,
}: {
    icon?: LucideIcon;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 text-sm">
            {Icon ? (
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1">{children}</div>
        </div>
    );
}
