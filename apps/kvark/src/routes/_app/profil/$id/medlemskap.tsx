import { authQueryOptions } from "#/api/auth";
import { getUserProfileQuery } from "#/api/queries/user";
import { groupTypeLabel } from "#/lib/group";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import { Badge } from "@tihlde/ui/ui/badge";
import { Card } from "@tihlde/ui/ui/card";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/medlemskap")({
    component: RouteComponent,
});

function RouteComponent() {
    const { id } = Route.useParams();
    const { data: profile } = useSuspenseQuery(getUserProfileQuery(id));
    const { data: session } = useQuery(authQueryOptions);
    const isOwnProfile = session?.user.id === id;

    // study/studyyear er avledede grupper (projeksjon av Feide-data) og vises
    // ved profilbildet, ikke i medlemskapslisten. TIHLDE er ingen gruppe man
    // melder seg inn i – alle er med – så den skal heller ikke vises her.
    // Typen er UPPERCASE i DB.
    const memberships = profile.groups.filter(
        (g) => !["study", "studyyear", "tihlde"].includes(g.type.toLowerCase()),
    );

    if (memberships.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <UserCircle2 />
                    </EmptyMedia>
                    <EmptyTitle>Ingen medlemskap</EmptyTitle>
                    <EmptyDescription>
                        {isOwnProfile
                            ? "Du er ikke medlem i noen grupper ennå."
                            : `${profile.name} er ikke medlem i noen grupper.`}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {memberships.map((group) => (
                <li key={group.slug}>
                    <Card
                        size="sm"
                        className="flex-row items-center gap-3 px-3"
                        render={
                            <Link
                                to="/grupper/$slug"
                                params={{ slug: group.slug }}
                            />
                        }
                    >
                        <Avatar className="size-10 shrink-0">
                            {group.logoUrl ? (
                                <AvatarImage
                                    src={group.logoUrl}
                                    alt={group.name}
                                />
                            ) : null}
                            <AvatarFallback>
                                {group.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                                {group.name}
                            </span>
                            <span className="truncate text-sm text-muted-foreground">
                                {groupTypeLabel(group.type)}
                            </span>
                        </div>
                        <Badge
                            variant={
                                group.role === "leader"
                                    ? "default"
                                    : "secondary"
                            }
                        >
                            {group.role === "leader" ? "Leder" : "Medlem"}
                        </Badge>
                    </Card>
                </li>
            ))}
        </ul>
    );
}
