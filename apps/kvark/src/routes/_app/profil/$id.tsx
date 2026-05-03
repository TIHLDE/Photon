import {
    DetailLayout,
    DetailLayoutContent,
    DetailLayoutNav,
} from "#/components/detail-layout";
import { EditBioDialog } from "#/components/edit-bio-dialog";
import { MembershipQrDialog } from "#/components/membership-qr-dialog";
import { ProfileHeader } from "#/components/profile-header";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { USER } from "#/mock/profile";
import { Button } from "@tihlde/ui/ui/button";
import { LogOut } from "lucide-react";
import {
    PROFILE_PRIMARY_NAV,
    PROFILE_SECONDARY_NAV,
    type ProfileNavKey,
} from "#/components/profile-nav";
import { useState } from "react";

export const Route = createFileRoute("/_app/profil/$id")({
    component: RouteComponent,
});

function RouteComponent() {
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
                <Outlet />
            </DetailLayoutContent>
        </DetailLayout>
    );
}
