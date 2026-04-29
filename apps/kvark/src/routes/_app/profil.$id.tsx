import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { LogOut } from "lucide-react";
import { useState } from "react";

import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { EditBioDialog } from "#/components/edit-bio-dialog";
import { MembershipQrDialog } from "#/components/membership-qr-dialog";
import { ProfileEventRow } from "#/components/profile-event-row";
import { ProfileHeader } from "#/components/profile-header";
import { ProfileLinksSection } from "#/components/profile-links-section";
import {
    PROFILE_PRIMARY_NAV,
    PROFILE_SECONDARY_NAV,
    type ProfileNavKey,
} from "#/components/profile-nav";
import { ProfileOverviewHeader } from "#/components/profile-overview-header";
import { ProfileStatCard } from "#/components/profile-stat-card";
import { ProfileTodoRow } from "#/components/profile-todo-row";

import { STATS, TODOS, UPCOMING, USER } from "./profil.mock";

export const Route = createFileRoute("/_app/profil/$id")({
    component: ProfilePage,
});

function ProfilePage() {
    const [active, setActive] = useState<ProfileNavKey>("oversikt");

    return (
        <DetailLayout
            header={
                <ProfileHeader
                    user={USER}
                    actions={
                        <>
                            <MembershipQrDialog name={USER.name} />
                            <EditBioDialog />
                        </>
                    }
                />
            }
        >
            <DetailLayoutNav
                sections={[PROFILE_PRIMARY_NAV, PROFILE_SECONDARY_NAV]}
                active={active}
                onSelect={setActive}
                desktopFooter={
                    <Button variant="ghost" className="justify-start">
                        <LogOut />
                        Logg ut
                    </Button>
                }
            />

            <DetailLayoutContent>
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
            </DetailLayoutContent>
        </DetailLayout>
    );
}
