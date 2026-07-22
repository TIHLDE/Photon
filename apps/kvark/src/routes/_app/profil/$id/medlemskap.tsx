import { authQueryOptions } from "#/api/auth";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
    const { data: session } = useQuery(authQueryOptions);
    const groups = session?.groups ?? [];

    if (groups.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <UserCircle2 />
                    </EmptyMedia>
                    <EmptyTitle>Ingen medlemskap</EmptyTitle>
                    <EmptyDescription>
                        Du er ikke medlem i noen grupper ennå.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {groups.map((group) => (
                <li key={group.slug}>
                    <Card
                        size="sm"
                        className="flex-row items-center gap-3 px-3"
                    >
                        <Avatar className="size-10 shrink-0">
                            {group.imageUrl ? (
                                <AvatarImage
                                    src={group.imageUrl}
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
                                {group.type}
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
