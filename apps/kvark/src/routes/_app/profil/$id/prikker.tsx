import { requireOwnProfile } from "#/api/auth";
import { createFileRoute } from "@tanstack/react-router";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/prikker")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Ticket />
                </EmptyMedia>
                <EmptyTitle>Ingen prikker</EmptyTitle>
                <EmptyDescription>
                    Du har ingen aktive prikker. Alt er i orden.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
