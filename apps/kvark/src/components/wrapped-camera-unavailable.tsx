import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { FilmFrames } from "@tihlde/ui/ui/film-frames";
import { CircleCheck, Images } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import type { WrappedCameraReason } from "#/api/queries/wrapped";
import { useNow } from "#/hooks/use-now";
import { formatInOslo, formatOsloDateTime } from "#/lib/date";
import { formatOpensIn } from "#/lib/wrapped";

type WrappedCameraUnavailableProps = {
    reason: WrappedCameraReason;
    opensAt: string;
    closesAt: string;
    shotsPerPerson: number;
    shotsUsed: number;
    draftCount: number;
    /** Det siste bildet kom fram og tømte filmen akkurat nå. */
    lastArrived: boolean;
    eventLink: ReactElement;
    homeLink: ReactElement;
    myPhotosLink: ReactElement;
};

const DATE_TIME = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
} as const;

type State = {
    title: string;
    description: ReactNode;
    /** Den ene knappen, der det finnes et opplagt neste steg. */
    primary?: ReactNode;
    /** Tekstlenke når det ikke gjør det. */
    secondary?: ReactNode;
    extra?: ReactNode;
};

/**
 * Hvorfor kameraet ikke kan brukes akkurat nå, og hva som skjer videre — stort
 * nok til å leses av noen som ikke er helt edru. Én skjerm per grunn.
 */
export function WrappedCameraUnavailable(props: WrappedCameraUnavailableProps) {
    const { reason, shotsPerPerson, shotsUsed, lastArrived } = props;
    const { title, description, primary, secondary, extra } = describe(props);

    return (
        <Empty size="lg">
            <EmptyMedia className="flex flex-col gap-4">
                {reason === "no_shots_left" && lastArrived ? (
                    <Badge variant="secondary">
                        <CircleCheck />
                        Siste bilde kom fram
                    </Badge>
                ) : null}
                <FilmFrames
                    total={shotsPerPerson}
                    used={
                        reason === "no_shots_left" ? shotsPerPerson : shotsUsed
                    }
                />
            </EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {primary}
                {extra}
                {secondary}
            </EmptyContent>
        </Empty>
    );
}

function describe({
    reason,
    opensAt,
    closesAt,
    shotsUsed,
    draftCount,
    eventLink,
    homeLink,
    myPhotosLink,
}: WrappedCameraUnavailableProps): State {
    const toEvent = (
        <Button variant="link" size="lg" render={eventLink}>
            Til arrangementet
        </Button>
    );

    switch (reason) {
        case "disabled":
            return {
                title: "Ingen engangskamera",
                description:
                    "Engangskameraet er ikke skrudd på for dette arrangementet.",
                secondary: toEvent,
            };
        case "not_open_yet":
            return {
                title: "Kameraet åpner snart",
                description: (
                    <>
                        <WrappedOpensIn opensAt={opensAt} />
                        <span className="block">
                            {formatOsloDateTime(opensAt, DATE_TIME)}
                        </span>
                    </>
                ),
                secondary: toEvent,
            };
        case "closed":
            return {
                title: "Kameraet er stengt",
                description:
                    "Arrangøren velger ut bildene som deles. Bilder som ikke ble sendt inn, er slettet.",
                secondary: toEvent,
            };
        case "not_registered":
            return {
                title: "Bare for deltakere",
                description:
                    "Bare de med plass på arrangementet kan ta bilder.",
                primary: (
                    <Button
                        size="lg"
                        className="min-h-16 w-full"
                        render={eventLink}
                    >
                        Til arrangementet
                    </Button>
                ),
            };
        case "no_shots_left":
            if (draftCount > 0) {
                return {
                    title: "Filmen er full",
                    description: `Alle bildene ligger i Mine bilder. Send dem inn før kl. ${formatInOslo(closesAt, "HH:mm")}, ellers slettes de.`,
                    primary: (
                        <Button
                            size="lg"
                            className="min-h-16 w-full"
                            render={myPhotosLink}
                        >
                            <Images />
                            Se Mine bilder
                        </Button>
                    ),
                    extra: <p>Slett et bilde for å ta et nytt.</p>,
                };
            }
            return {
                title: "Filmen er full",
                description: `Alle ${shotsUsed} bildene er sendt til arrangøren.`,
                extra: (
                    <Card size="sm" className="w-full">
                        <CardHeader>
                            <CardTitle>Hva skjer nå</CardTitle>
                            <CardDescription>
                                Arrangøren velger ut bildene som deles.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ),
                secondary: (
                    <Button variant="link" size="lg" render={homeLink}>
                        Tilbake til forsiden
                    </Button>
                ),
            };
    }
}

/**
 * «om 1 t 23 min». Egen komponent, så det bare er den som tegnes på nytt
 * hvert sekund, ikke hele sida.
 */
function WrappedOpensIn({ opensAt }: { opensAt: string }) {
    const now = useNow(opensAt);
    return <span className="block">{formatOpensIn(opensAt, now)}</span>;
}
