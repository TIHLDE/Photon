import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Gamle gruppeundersider var egne adresser (/grupper/<slug>/boter). Nå er de
 * faner på gruppesiden, styrt av ?tab=. Navnene er de samme, så den gamle
 * lenken lander på riktig fane — ukjente undersider går til Om.
 *
 * Eksplisitt $section og ikke en splat: `/grupper/$slug/$` matcher også
 * `/grupper/<slug>` selv, siden splat-en kan være tom, og gruppesiden endte i
 * en redirect-løkke.
 */
const TAB_BY_LEGACY_SECTION = {
    arrangementer: "arrangementer",
    boter: "boter",
    lovverk: "lovverk",
    sporreskjema: "sporreskjema",
    medlemmer: "medlemmer",
} as const;

export const Route = createFileRoute("/_app/grupper/$slug/$section")({
    beforeLoad: ({ params }) => {
        const tab =
            TAB_BY_LEGACY_SECTION[
                params.section as keyof typeof TAB_BY_LEGACY_SECTION
            ] ?? "om";

        throw redirect({
            to: "/grupper/$slug",
            params: { slug: params.slug },
            search: { tab },
            replace: true,
            statusCode: 301,
        });
    },
});
