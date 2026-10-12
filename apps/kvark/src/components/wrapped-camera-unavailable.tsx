import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { CameraOff, Clock, Lock, UserX } from "lucide-react";
import type { ReactNode } from "react";

import type { WrappedCameraReason } from "#/api/queries/wrapped";
import { formatOsloDateTime } from "#/lib/date";

type WrappedCameraUnavailableProps = {
    reason: WrappedCameraReason;
    opensAt: string;
};

const DATE_TIME = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
} as const;

/** Hvorfor kameraet ikke kan brukes akkurat nå — én tekst per grunn. */
export function WrappedCameraUnavailable({
    reason,
    opensAt,
}: WrappedCameraUnavailableProps) {
    const { icon, title, description } = describe(reason, opensAt);

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">{icon}</EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

function describe(
    reason: WrappedCameraReason,
    opensAt: string,
): { icon: ReactNode; title: string; description: string } {
    switch (reason) {
        case "disabled":
            return {
                icon: <CameraOff />,
                title: "Ingen engangskamera",
                description:
                    "Engangskameraet er ikke skrudd på for dette arrangementet.",
            };
        case "not_open_yet":
            return {
                icon: <Clock />,
                title: "Kameraet er ikke åpnet ennå",
                description: `Kameraet åpner ${formatOsloDateTime(opensAt, DATE_TIME)}.`,
            };
        case "closed":
            return {
                icon: <Lock />,
                title: "Kameraet er stengt",
                description: "Bildene kommer etter arrangementet.",
            };
        case "not_registered":
            return {
                icon: <UserX />,
                title: "Bare for deltakere",
                description:
                    "Bare de med plass på arrangementet kan ta bilder.",
            };
        case "no_shots_left":
            return {
                icon: <CameraOff />,
                title: "Ingen bilder igjen",
                description:
                    "Du har brukt alle bildene dine. De kommer etter arrangementet.",
            };
    }
}
