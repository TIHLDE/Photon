import { requireOwnProfile } from "#/api/auth";
import { createFileRoute } from "@tanstack/react-router";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { HelpCircle } from "lucide-react";

export const Route = createFileRoute("/_app/profil/$id/sporreskjemaer")({
    component: RouteComponent,
    beforeLoad: ({ location, params }) =>
        requireOwnProfile(params.id, location.href),
});

function RouteComponent() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <HelpCircle />
                </EmptyMedia>
                <EmptyTitle>Ingen spørreskjemaer</EmptyTitle>
                <EmptyDescription>
                    Spørreskjemaer du må svare på vil dukke opp her.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
