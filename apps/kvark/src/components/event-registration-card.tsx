import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { VippsButton } from "@tihlde/ui/ui/vipps-button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Progress } from "@tihlde/ui/ui/progress";
import {
    AlertCircle,
    Ban,
    CalendarCheck,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Hourglass,
    Lock,
    QrCode,
    Tag,
    Ticket,
    Users,
    type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type {
    EventDeadline,
    EventPrice,
    EventRegistrationState,
} from "#/lib/event";

type EventRegistrationCardProps = {
    registrationState: EventRegistrationState;
    registrationOpensAt?: EventDeadline;
    registrationOpensInLabel?: string;
    registrationClosesAt?: EventDeadline;
    unregisterDeadline?: EventDeadline;
    /**
     * Satt når medlemmet har betalt for plassen. Da forsvinner avmeldingen:
     * systemet refunderer ikke automatisk, og API-et avviser forsøket.
     */
    hasPaid?: boolean;
    paymentDeadline?: EventDeadline;
    /**
     * «9:32», «0:14» — tida medlemmet har igjen på å betale, som teller ned
     * mens sida står åpen.
     * Betalingsvinduet er kort, så en frist på klokka sier lite: det som
     * betyr noe er hvor lenge det er til plassen gis videre. Satt til
     * `null` når fristen allerede har gått ut.
     */
    paymentExpiresInLabel?: string | null;
    /**
     * Satt mens vi spør Vipps om betalingen som nettopp ble gjennomført.
     * Da forsvinner både betalings- og avmeldingsknappen: betalingen er ute
     * av medlemmets hender, og et nytt trykk ville enten startet en betaling
     * til, eller meldt av en plass de akkurat har betalt for.
     */
    isConfirmingPayment?: boolean;
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
    /**
     * Vises når medlemmet har fått plassen sin — brukt til å be dem oppgi
     * allergier. Settes bare av forelderen når det faktisk er noe å be om, så
     * kortet trenger ikke vite noe om hverken sesjon eller innstillinger.
     */
    postJoinSlot?: ReactNode;
    /**
     * Lenka til Facebook-gruppa for billettsalg. Settes bare når medlemmet har
     * betalt for plassen sin, så tilbudet om å selge billetten videre kun
     * dukker opp for dem som faktisk har en billett å selge.
     */
    ticketResaleUrl?: string;
    /**
     * Satt når medlemmet ikke har godkjent arrangementsreglene. Da vises
     * `eventRulesSlot` i stedet for påmeldingsknappen — også før påmeldingen
     * åpner, som er hele poenget: de skal oppdage det i god tid.
     */
    requiresEventRulesConsent?: boolean;
    eventRulesSlot?: ReactNode;
    notEligibleReason?: string;
    waitlistPosition?: number;
    /** Satt mens en på-/avmelding er underveis, så knappen ikke kan dobbeltklikkes. */
    isSubmitting?: boolean;
    /**
     * Feilmeldingen fra siste forsøk på å melde seg på eller av. Uten denne
     * så knappen ut til å ikke gjøre noe når API-et avviste påmeldingen.
     */
    actionError?: string | null;
    /**
     * Overskriften over `actionError`. Standarden gjelder påmeldingen; en
     * betaling som ikke lot seg starte er noe annet, og da ville «Påmeldingen
     * gikk ikke gjennom» sendt medlemmet ut på leting etter en påmelding som
     * er helt i orden.
     */
    actionErrorTitle?: string;
};

export function EventRegistrationCard(props: EventRegistrationCardProps) {
    const timeline = buildTimeline(props);
    // Bare tilstandene der medlemmet ellers kunne ha meldt seg på — å be noen
    // godkjenne reglene på et arrangement som er stengt hjelper ingen.
    const blockedByEventRules =
        props.requiresEventRulesConsent === true &&
        (props.registrationState === "open" ||
            props.registrationState === "not-open" ||
            props.registrationState === "full");
    const state = getStateRendering(props, blockedByEventRules);
    // Uten påmelding er både tidslinjen og «0/∞ påmeldte» bare støy.
    const showRegistrationDetails = props.registrationState !== "no-signup";

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
                {showRegistrationDetails && timeline.length >= 2 ? (
                    <RegistrationTimeline points={timeline} />
                ) : null}
                {showRegistrationDetails ? (
                    <RegistrationStats {...props} />
                ) : null}
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
                {blockedByEventRules ? props.eventRulesSlot : null}
                {state.actions}
                {props.actionError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertTitle>
                            {props.actionErrorTitle ??
                                "Påmeldingen gikk ikke gjennom"}
                        </AlertTitle>
                        <AlertDescription>{props.actionError}</AlertDescription>
                    </Alert>
                ) : null}
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

function getStateRendering(
    props: EventRegistrationCardProps,
    blockedByEventRules: boolean,
): StateRendering {
    const state = props.registrationState;

    switch (state) {
        case "no-signup":
            return {
                icon: CalendarCheck,
                message: "Dette arrangementet har ikke påmelding",
                secondary: "Bare møt opp.",
            };

        case "processing":
            return {
                icon: Hourglass,
                message: "Behandler påmeldingen din …",
                secondary: "Vi gir deg beskjed så snart plassen er klar.",
            };

        case "not-open":
            return {
                icon: AlertCircle,
                message: `Påmelding åpner om ${props.registrationOpensInLabel ?? "en stund"}`,
                // Varslingen finnes ikke ennå, så knappen vises kun når noen
                // faktisk har koblet på en handler.
                actions: props.onNotify ? (
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={props.onNotify}
                    >
                        <CalendarClock />
                        Varsle meg
                    </Button>
                ) : null,
            };

        case "joined":
            return {
                icon: CheckCircle2,
                message: "Du har plass på arrangementet!",
                secondary: props.hasPaid
                    ? "Du har betalt, så plassen kan ikke meldes av."
                    : null,
                actions: (
                    <>
                        {props.postJoinSlot}
                        {props.qrSlot ?? (
                            <Button className="w-full">
                                <QrCode />
                                Påmeldingsbevis
                            </Button>
                        )}
                        {props.ticketResaleUrl ? (
                            <Button
                                variant="outline"
                                className="w-full"
                                render={
                                    <a
                                        href={props.ticketResaleUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                }
                            >
                                <Ticket />
                                Selg billetten din
                            </Button>
                        ) : null}
                        {/* En betalt plass kan ikke gis fra seg — den selges
                            videre. API-et avviser avmeldingen uansett. */}
                        {!props.hasPaid && (
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={props.onUnregister}
                            >
                                Meld deg av
                            </Button>
                        )}
                    </>
                ),
            };

        case "awaiting-payment":
            if (props.isConfirmingPayment) {
                return {
                    icon: Hourglass,
                    message: "Bekrefter betalingen …",
                    secondary: "Vi venter på svar fra Vipps.",
                };
            }

            return {
                icon: CreditCard,
                message: "Plass reservert — venter på betaling",
                // Uten frist står plassen til arrangøren rydder opp. Da er det
                // riktigere å si ingenting enn å dikte opp en frist.
                secondary: paymentDeadlineText(props),
                actions: (
                    <>
                        <VippsButton
                            className="w-full"
                            loading={props.isSubmitting}
                            onClick={props.onPay}
                        />
                        <Button
                            variant="ghost"
                            className="w-full"
                            disabled={props.isSubmitting}
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

        // Fullt stopper aldri en påmelding: det finnes alltid en venteliste, og
        // plassen går videre til den som står først når noen melder seg av.
        case "full":
            return {
                icon: AlertCircle,
                message: "Arrangementet er fullt",
                secondary:
                    props.waitlistCount > 0
                        ? `${props.waitlistCount} står på venteliste.`
                        : "Meld deg på ventelista, så får du plassen om noen melder seg av.",
                // Ventelista går gjennom samme påmelding, så den er stengt av
                // samme grunn — knappen ville bare gitt en avvisning.
                actions: blockedByEventRules ? null : (
                    <Button
                        variant="outline"
                        className="w-full"
                        disabled={props.isSubmitting}
                        onClick={() => props.onJoinWaitlist?.()}
                    >
                        {props.isSubmitting
                            ? "Setter deg på ventelista …"
                            : "Meld meg på"}
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
            // Varselet forklarer hvorfor, og har handlingen som låser opp
            // påmeldingen. En knapp ved siden av ville bare blitt avvist.
            if (blockedByEventRules) return {};

            return {
                actions: (
                    <Button
                        className="w-full"
                        disabled={props.isSubmitting}
                        onClick={() => props.onRegister?.()}
                    >
                        {props.isSubmitting ? "Melder deg på …" : "Meld deg på"}
                    </Button>
                ),
            };

        default: {
            const _exhaustive: never = state;
            return _exhaustive;
        }
    }
}

/**
 * Fristteksten under «Plass reservert — venter på betaling».
 *
 * Nedtellingen står først: vinduet er på minutter, og da er «7:31 igjen» det
 * medlemmet trenger å vite. Klokkeslettet blir stående ved siden av, så
 * fristen er til å planlegge etter når det er lenge igjen.
 */
function paymentDeadlineText(props: EventRegistrationCardProps): string | null {
    if (!props.paymentDeadline) return null;
    // Nedtellingen kan ha passert fristen før serveren har rukket å gi plassen
    // videre. Da er «betal innen 0 sekunder» feil — plassen er ute av
    // medlemmets hender, og det eneste ærlige er å si det.
    if (props.paymentExpiresInLabel === null) {
        return "Betalingsfristen er gått ut. Plassen kan ha gått videre til neste på ventelista.";
    }
    if (!props.paymentExpiresInLabel) {
        return `Betal innen ${props.paymentDeadline.day} kl. ${props.paymentDeadline.time}.`;
    }
    return `${props.paymentExpiresInLabel} igjen å betale (innen kl. ${props.paymentDeadline.time}).`;
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
        !props.hasPaid &&
        (props.registrationState === "joined" ||
            props.registrationState === "awaiting-payment");
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
        // Med tre punkter (Åpnet / Avmelding / Lukker) er det ikke plass på
        // én linje på mobil. `flex-wrap` lar punktene stable seg i stedet for
        // å presse kortet — og dermed hele sida — ut av skjermen. Streken
        // gir bare mening når punktene faktisk står ved siden av hverandre,
        // så den skjules på de smaleste skjermene.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {points.map((point, i) => (
                <Fragment key={point.label}>
                    {i > 0 ? (
                        <div className="hidden h-px flex-1 bg-border sm:block" />
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5">
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
