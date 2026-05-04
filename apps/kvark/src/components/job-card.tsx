import { Link } from "@tanstack/react-router";
import { CalendarClock, GraduationCap, MapPin } from "lucide-react";

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
            renderLink={(p) => (
                <Link
                    to="/annonser/$slug"
                    params={{ slug }}
                    className={p.className}
                >
                    {p.children}
                </Link>
            )}
            title={title}
            imageUrl={imageUrl}
            imageBadge={jobType}
            meta={[
                { icon: GraduationCap, text: classLevels },
                { icon: MapPin, text: location },
                { icon: CalendarClock, text: deadline },
            ]}
        />
    );
}
