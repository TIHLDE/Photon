import { Link, type LinkOptions } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

type AdminStatCardProps = {
    label: string;
    value: number | string;
    icon: LucideIcon;
    hint?: string;
    /** When provided, the whole card becomes a link into that section. */
    link?: LinkOptions;
};

/**
 * Compact metric tile for the admin dashboard. Renders a labelled count with an
 * icon; when a link is supplied the entire card is clickable.
 */
export function AdminStatCard({
    label,
    value,
    icon: Icon,
    hint,
    link,
}: AdminStatCardProps) {
    const content = (
        <CardContent className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-3xl leading-none">{value}</span>
                {hint && (
                    <span className="text-xs text-muted-foreground">
                        {hint}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
                <Icon className="size-5" />
                {link && <ArrowUpRight className="size-4" />}
            </div>
        </CardContent>
    );

    if (link) {
        return (
            <Card render={<Link {...link} />} className="cursor-pointer">
                {content}
            </Card>
        );
    }

    return <Card>{content}</Card>;
}
