import { ProfileEventRow } from "#/components/profile-event-row";
import { ProfileLinksSection } from "#/components/profile-links-section";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
import { ProfileStatCard } from "#/components/profile-stat-card";
import { ProfileTodoRow } from "#/components/profile-todo-row";
import { STATS, TODOS, UPCOMING, USER } from "#/mock/profile";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/profil/$id/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <>
            <ProfileOverviewHeader name={USER.name} notifications={2} />
            <ProfileLinksSection links={USER.links} />

            <div className="grid gap-4 md:grid-cols-3">
                {STATS.map((stat) => (
                    <ProfileStatCard key={stat.label} {...stat} />
                ))}
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-xs text-muted-foreground">KOMMENDE</h3>
                <ul className="flex flex-col gap-3">
                    {UPCOMING.map((event) => (
                        <li key={event.title}>
                            <ProfileEventRow {...event} />
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-xs text-muted-foreground">MÅ GJØRES</h3>
                <ul className="flex flex-col gap-3">
                    {TODOS.map((todo) => (
                        <li key={todo.title}>
                            <ProfileTodoRow {...todo} />
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
