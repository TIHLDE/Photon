import { Outlet, createFileRoute, linkOptions } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { authQueryOptions } from "#/api/auth";
import { SiteFooter } from "#/components/site-footer";
import { SiteHeader, type NavItem } from "#/components/site-header";
import { useMemo } from "react";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
    const { data: session } = useQuery(authQueryOptions);

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

    // Mock this for now
    const isNewStudentTime = false;

    const navItems = useMemo(
        () =>
            [
                {
                    kind: "group",
                    label: "Generelt",
                    items: [
                        {
                            kind: "internal",
                            label: "Nyheter",
                            link: linkOptions({ to: "/nyheter" }),
                            description: "Se de siste nyhetene fra TIHLDE",
                        },
                        {
                            kind: "internal",
                            label: "TÖDDEL",
                            link: linkOptions({ to: "/toddel" }),
                            description: "TIHLDE sitt eget studentblad",
                        },
                        {
                            kind: "internal",
                            label: "Gruppeoversikt",
                            link: linkOptions({ to: "/grupper" }),
                            description:
                                "Få oversikt over alle verv og grupper",
                        },
                        {
                            kind: "external",
                            label: "Fondet",
                            href: "https://fondet.tihlde.org",
                            description:
                                "Se hvordan det ligger an med fondet vårt",
                        },
                    ],
                },

                ...(isNewStudentTime
                    ? [
                          {
                              kind: "internal",
                              label: "Ny student",
                              link: linkOptions({ to: "/" }),
                          },
                      ]
                    : []),

                {
                    kind: "internal",
                    label: "Arrangementer",
                    link: linkOptions({ to: "/arrangementer" }),
                },
                {
                    kind: "external",
                    label: "Wiki",
                    href: "https://wiki.tihlde.org",
                },
                {
                    kind: "internal",
                    label: "Stillinger",
                    link: linkOptions({ to: "/annonser" }),
                },
                ...(!isAuthenticated
                    ? [
                          {
                              kind: "internal",
                              label: "For Bedrifter",
                              link: linkOptions({ to: "/bedrift" }),
                          },
                      ]
                    : []),
                ...(isAuthenticated
                    ? [
                          {
                              kind: "group",
                              label: "For Medlemmer",
                              items: [
                                  {
                                      kind: "internal",
                                      label: "Opptak",
                                      link: linkOptions({ to: "/opptak" }),
                                      description: "Søk verv hos TIHLDE",
                                  },
                                  {
                                      kind: "internal",
                                      label: "Kokebok",
                                      link: linkOptions({ to: "/kokebok" }),
                                      description: "Få hjelp til dine øvinger",
                                  },
                                  {
                                      kind: "internal",
                                      label: "QR koder",
                                      link: linkOptions({ to: "/qr-koder" }),
                                      description: "Generer dine egne QR koder",
                                  },
                                  {
                                      kind: "internal",
                                      label: "Galleri",
                                      link: linkOptions({ to: "/galleri" }),
                                      description:
                                          "Se alle bilder fra TIHLDE sine arrangementer",
                                  },
                                  {
                                      kind: "external",
                                      label: "Kontres",
                                      href: "https://new-kontres.tihlde.org",
                                      description:
                                          "Reserver kontor og utstyr fra TIHLDE",
                                  },
                              ],
                          },
                      ]
                    : []),
            ] as NavItem[],
        [isAuthenticated, isNewStudentTime],
    );
    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader navItems={navItems} user={currentUser} />
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <SiteFooter />
        </div>
    );
}
