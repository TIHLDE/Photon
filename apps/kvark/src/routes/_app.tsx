import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";
import { EventRulesConsent } from "#/components/event-rules-consent";
import { NotificationBell } from "#/components/notification-bell";
import { PendingApprovalNotice } from "#/components/pending-approval-notice";
import { SetPasswordNotice } from "#/components/set-password-notice";
import { SiteBottomBar } from "#/components/site-bottom-bar";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { useSiteNavItems } from "#/components/site-nav-items";
import { useEventRulesConsent } from "#/hooks/use-event-rules-consent";
import { useSetPassword } from "#/hooks/use-set-password";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
    const { data: session } = useQuery(authQueryOptions);
    // Vises over hele appen til reglene er godkjent, så ingen møter sperren
    // først i det påmeldingen åpner.
    const eventRules = useEventRulesConsent();
    // Blir stående til passordet finnes. Ikke blokkerende: de kom gjennom
    // Feide, så retten til å være her er allerede bevist.
    const setPassword = useSetPassword();

    const currentUser = session?.user
        ? {
              name: session.user.name,
              avatarUrl:
                  session.user.settings?.imageUrl ??
                  session.user.image ??
                  undefined,
          }
        : null;
    const isAuthenticated = Boolean(currentUser);
    // En selvregistrert bruker kan logge inn med én gang, men er ikke medlem
    // før noen har sagt ja. Det må stå et sted de faktisk ser det — og
    // medlemsmenyen skjules, siden hver side der svarer 403 for dem.
    const isPendingApproval = session?.user?.isPendingApproval === true;
    // Allergispørsmålet er det eneste medlemmet kan bli sittende med ubesvart
    // uten å merke det, og arrangørene bestiller mat etter svarene. Prikken
    // blir stående til de har svart — også når svaret er «jeg har ingen».
    // Ingen ekstra kall: bekreftelsen ligger i sesjonen fra før.
    const hasProfileTodo =
        isAuthenticated &&
        !isPendingApproval &&
        session?.user.settings?.allergiesConfirmedAt == null;
    const navItems = useSiteNavItems(isAuthenticated, !isPendingApproval);

    return (
        // The bottom padding keeps the footer clear of the fixed bottom bar,
        // which only exists below lg.
        <div className="flex min-h-screen flex-col pb-16 lg:pb-0">
            <SiteHeader
                navItems={navItems}
                user={currentUser}
                hasProfileTodo={hasProfileTodo}
                // Bjella spør etter uleste varsler, så den vises bare for
                // innloggede — ellers ville hver besøkende få en 401. Den som
                // venter på godkjenning får 403 på samme kall, og har uansett
                // ingen varsler ennå.
                actions={
                    isAuthenticated && !isPendingApproval ? (
                        <NotificationBell />
                    ) : null
                }
            />
            {isPendingApproval ? (
                <div className="container mx-auto px-4 pt-4">
                    <PendingApprovalNotice />
                </div>
            ) : null}
            {setPassword.mustSet ? (
                <div className="container mx-auto px-4 pt-4">
                    <SetPasswordNotice
                        state={setPassword.state}
                        href={setPassword.href}
                    />
                </div>
            ) : null}
            {eventRules.mustAccept ? (
                <div className="container mx-auto px-4 pt-4">
                    <EventRulesConsent
                        onAccept={eventRules.acceptEventRules}
                        isSubmitting={eventRules.isSubmitting}
                        error={eventRules.error}
                    />
                </div>
            ) : null}
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <SiteFooter />
            <SiteBottomBar
                navItems={navItems}
                isAuthenticated={isAuthenticated}
                hasProfileTodo={hasProfileTodo}
            />
        </div>
    );
}
