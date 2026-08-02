import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";

type ProfileMembershipCardProps = {
    slug: string;
    name: string;
    /** Norsk visningsnavn for gruppetypen, f.eks. «Undergruppe». */
    typeLabel: string;
    logoUrl?: string | null;
    role: string;
    /** «Medlem 2023–2025» for avsluttede medlemskap. Utelates for aktive. */
    period?: string;
};

/**
 * Én gruppe på profilens medlemskapsfane. Brukes både for aktive og
 * avsluttede medlemskap — det avsluttede har i tillegg en periode.
 */
export function ProfileMembershipCard({
    slug,
    name,
    typeLabel,
    logoUrl,
    role,
    period,
}: ProfileMembershipCardProps) {
    return (
        <Card
            size="sm"
            className="flex-row items-center gap-3 px-3"
            render={<Link to="/grupper/$slug" params={{ slug }} />}
        >
            <Avatar className="size-10 shrink-0">
                {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
                <AvatarFallback>
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-sm text-muted-foreground">
                    {period ? `${typeLabel} · ${period}` : typeLabel}
                </span>
            </div>
            <Badge variant={role === "leader" ? "default" : "secondary"}>
                {role === "leader" ? "Leder" : "Medlem"}
            </Badge>
        </Card>
    );
}
