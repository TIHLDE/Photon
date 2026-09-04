import { linkOptions } from "@tanstack/react-router";
import { useMemo } from "react";

import type { NavItem } from "#/components/site-header";

/**
 * The site navigation, shared by the header, the mobile bottom bar and the
 * auth pages. Lives outside the layouts so every shell that shows navigation
 * shows the same navigation.
 */
/**
 * @param isAuthenticated Om noen er logget inn i det hele tatt.
 * @param isMember Om den innloggede faktisk er medlem. En selvregistrert bruker
 *   som venter på godkjenning er logget inn, men hver side under «For
 *   Medlemmer» svarer 403 for dem — så menyen skjules i stedet for å tilby
 *   lenker som bare fører til en feilmelding. Standard `true` holder kallere
 *   som ikke bryr seg om skillet uendret.
 */
export function useSiteNavItems(
    isAuthenticated: boolean,
    isMember: boolean = true,
): NavItem[] {
    // Vis "Ny student" i navmenyen fra og med juni til og med august
    const month = new Date().getMonth();
    const isNewStudentTime = month >= 5 && month <= 7;

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
                              link: linkOptions({ to: "/ny-student" }),
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
                    kind: "external",
                    label: "Varsling",
                    href: "https://forms.gle/UE85Da8et8VJc7XWA",
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
                ...(isAuthenticated && isMember
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
                                          "Se bilder fra TIHLDEs arrangementer",
                                  },
                                  {
                                      kind: "internal",
                                      label: "Søknader",
                                      link: linkOptions({ to: "/soknader" }),
                                      description:
                                          "Send inn utlegg og søknader til TIHLDE",
                                  },
                                  {
                                      kind: "external",
                                      label: "Kontres",
                                      href: "https://kontres.tihlde.org",
                                      description:
                                          "Reserver kontor og utstyr fra TIHLDE",
                                  },
                              ],
                          },
                      ]
                    : []),
            ] as NavItem[],
        [isAuthenticated, isMember, isNewStudentTime],
    );

    return navItems;
}
