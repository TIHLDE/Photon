import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";
import { Text } from "@tihlde/ui/ui/text";

import { avatarImageUrl } from "#/lib/assets";

type ProfileMembershipCardProps = {
    slug: string;
    name: string;
    /** Norsk visningsnavn for gruppetypen, f.eks. «Undergruppe». */
    typeLabel: string;
    logoUrl?: string | null;
    role: string;
    /** «Medlem 2023–2025» for avsluttede medlemskap. Utelates for aktive. */
    period?: string;
    /**
     * Om gruppesiden er åpen for den som ser på. Privat gruppe man ikke er
     * medlem av svarer 403, så da vises kortet uten lenke i stedet for å sende
     * folk til en feilmelding.
     */
    canOpen?: boolean;
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
    canOpen = true,
}: ProfileMembershipCardProps) {
    return (
        <Card
            size="sm"
            className="flex-row items-center gap-3 px-3"
            render={
                canOpen ? (
                    <Link to="/grupper/$slug" params={{ slug }} />
                ) : undefined
            }
        >
            <Avatar className="size-10 shrink-0">
                {logoUrl ? (
                    <AvatarImage src={avatarImageUrl(logoUrl)} alt={name} />
                ) : null}
                <AvatarFallback>
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
                <Text render={<span />} weight="medium" className="truncate">
                    {name}
                </Text>
                <Text
                    render={<span />}
                    size="sm"
                    tone="muted"
                    className="truncate"
                >
                    {period ? `${typeLabel} · ${period}` : typeLabel}
                </Text>
            </div>
            <Badge variant={role === "leader" ? "default" : "secondary"}>
                {role === "leader" ? "Leder" : "Medlem"}
            </Badge>
        </Card>
    );
}
