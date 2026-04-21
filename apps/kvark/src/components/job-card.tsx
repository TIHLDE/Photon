import { Badge } from "@tihlde/ui/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { CalendarClock, MapPin } from "lucide-react";

export type JobCardProps = {
    title: string;
    company: string;
    jobType: string;
    classLevels: string;
    location: string;
    deadline: string;
    logoUrl?: string;
};

export function JobCard({
    title,
    company,
    jobType,
    classLevels,
    location,
    deadline,
    logoUrl,
}: JobCardProps) {
    return (
        <Card size="sm" className="flex-row gap-0">
            <div className="flex aspect-square w-32 shrink-0 items-center justify-center overflow-hidden bg-muted sm:w-40">
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={company}
                        className="size-full object-contain"
                    />
                ) : (
                    <span className="text-muted-foreground">{company}</span>
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <CardHeader className="p-0">
                    <CardTitle className="truncate">{title}</CardTitle>
                </CardHeader>
                <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{jobType}</Badge>
                    <Badge variant="secondary">{company}</Badge>
                    <Badge variant="secondary">{classLevels}</Badge>
                </div>
                <CardContent className="flex flex-col gap-1 p-0">
                    <div className="flex items-center gap-2">
                        <MapPin className="size-3.5" />
                        <span className="truncate">{location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarClock className="size-3.5" />
                        <span className="truncate">{deadline}</span>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}
