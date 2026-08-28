import { Link } from "@tanstack/react-router";
import { CalendarClock, MapPin } from "lucide-react";

import { ListCard } from "#/components/list-card";

export type JobCardProps = {
    slug: string;
    title: string;
    jobType: string;
    classLevels: string;
    location: string;
    deadline: string;
    imageUrl?: string;
};

export function JobCard({
    slug,
    title,
    jobType,
    classLevels,
    location,
    deadline,
    imageUrl,
}: JobCardProps) {
    return (
        <ListCard
            render={<Link to="/annonser/$slug" params={{ slug }} />}
            title={title}
            imageUrl={imageUrl}
            imageBadge={jobType}
            /*
             * Sted og klassetrinn deler rad. Da har annonsekortet like mange
             * metarader som arrangementskortet, og de blir like høye — coveret
             * er låst til 21:9 og ville ellers latt en tredje rad stikke ut
             * under bildet.
             */
            meta={[
                { icon: MapPin, text: `${location} · ${classLevels}` },
                { icon: CalendarClock, text: deadline },
            ]}
        />
    );
}
