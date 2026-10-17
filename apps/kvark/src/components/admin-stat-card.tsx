import { Link, type LinkOptions } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Text } from "@tihlde/ui/ui/text";
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
                <Text render={<span />} size="sm" tone="muted">
                    {label}
                </Text>
                <span className="text-3xl leading-none">{value}</span>
                {hint && (
                    <Text render={<span />} size="xs" tone="muted">
                        {hint}
                    </Text>
                )}
            </div>
            <Text
                render={<div />}
                tone="muted"
                className="flex items-center gap-1"
            >
                <Icon className="size-5" />
                {link && <ArrowUpRight className="size-4" />}
            </Text>
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
