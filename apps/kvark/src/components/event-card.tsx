import { Link } from "@tanstack/react-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Badge } from "@tihlde/ui/ui/badge";
import { CalendarDays, MapPin } from "lucide-react";

export type EventCardProps = {
    slug: string;
    title: string;
    startsAt: string;
    location: string;
    imageUrl?: string;
    category?: string;
};

export function EventCard({
    slug,
    title,
    startsAt,
    location,
    imageUrl,
    category,
}: EventCardProps) {
    return (
        <Link to="/arrangementer/$slug" params={{ slug }} className="block">
            <Card size="sm" className="flex-row gap-0">
                <div className="relative aspect-square w-28 shrink-0 overflow-hidden sm:w-32">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt=""
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="size-full bg-muted" aria-hidden />
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                    <CardHeader className="p-0">
                        <CardTitle className="truncate">{title}</CardTitle>
                        {category ? (
                            <CardDescription>
                                <Badge variant="secondary">{category}</Badge>
                            </CardDescription>
                        ) : null}
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1 p-0">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="size-3.5" />
                            <span className="truncate">{startsAt}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="size-3.5" />
                            <span className="truncate">{location}</span>
                        </div>
                    </CardContent>
                </div>
            </Card>
        </Link>
    );
}
