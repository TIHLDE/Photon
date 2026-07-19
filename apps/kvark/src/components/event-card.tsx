import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";

import { ListCard } from "#/components/list-card";

export type EventCardProps = {
    slug: string;
    title: string;
    startsAt: string;
    location: string;
    organizer: string;
    category?: string;
    imageUrl?: string;
    capacity?: number | null;
    registeredCount?: number;
};

export function EventCard({
    slug,
    title,
    startsAt,
    location,
    organizer,
    imageUrl,
    capacity,
    registeredCount,
}: EventCardProps) {
    const meta = [
        { icon: CalendarDays, text: startsAt },
        { icon: MapPin, text: location },
    ];

    if (registeredCount !== undefined) {
        meta.push({
            icon: UsersRound,
            text: `${registeredCount}${
                capacity !== null && capacity !== undefined
                    ? `/${capacity}`
                    : ""
            }`,
        });
    }

    return (
        <ListCard
            render={<Link to="/arrangementer/$slug" params={{ slug }} />}
            title={title}
            imageUrl={imageUrl}
            imageBadge={organizer}
            meta={meta}
        />
    );
}
