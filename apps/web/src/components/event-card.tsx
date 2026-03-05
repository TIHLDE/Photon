import type { EventListItem } from "@tihlde/sdk/types";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { formatDateRange } from "~/lib/date";

type EventCardProps = {
    event: EventListItem;
};

export function EventCard({ event }: EventCardProps) {
    return (
        <a href={`/arrangementer/${event.id}`}>
            <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                {event.image && (
                    <div className="aspect-[2/1] overflow-hidden">
                        <img
                            src={event.image}
                            alt={event.title}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                )}
                <div className="space-y-2 p-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                            {event.category.label}
                        </Badge>
                        {event.closed && (
                            <Badge
                                variant="outline"
                                className="text-muted-foreground"
                            >
                                Stengt
                            </Badge>
                        )}
                    </div>
                    <h3 className="font-heading text-lg font-semibold leading-tight group-hover:text-primary">
                        {event.title}
                    </h3>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {formatDateRange(event.startTime, event.endTime)}
                        </span>
                        {event.location && (
                            <span className="flex items-center gap-1.5">
                                <MapPin className="size-3.5" />
                                {event.location}
                            </span>
                        )}
                    </div>
                    {event.organizer && (
                        <p className="text-xs text-muted-foreground">
                            Av {event.organizer.name}
                        </p>
                    )}
                </div>
            </Card>
        </a>
    );
}
