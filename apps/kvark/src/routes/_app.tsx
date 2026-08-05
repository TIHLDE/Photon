import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";
import { EventRulesConsent } from "#/components/event-rules-consent";
import { NotificationBell } from "#/components/notification-bell";
import { SiteBottomBar } from "#/components/site-bottom-bar";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";
import { useSiteNavItems } from "#/components/site-nav-items";
import { useEventRulesConsent } from "#/hooks/use-event-rules-consent";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
    const { data: session } = useQuery(authQueryOptions);
    // Vises over hele appen til reglene er godkjent, så ingen møter sperren
    // først i det påmeldingen åpner.
    const eventRules = useEventRulesConsent();

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
    const navItems = useSiteNavItems(isAuthenticated);

    return (
        // The bottom padding keeps the footer clear of the fixed bottom bar,
        // which only exists below md.
        <div className="flex min-h-screen flex-col pb-16 md:pb-0">
            <SiteHeader
                navItems={navItems}
                user={currentUser}
                // Bjella spør etter uleste varsler, så den vises bare for
                // innloggede — ellers ville hver besøkende få en 401.
                actions={isAuthenticated ? <NotificationBell /> : null}
            />
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
            />
        </div>
    );
}
