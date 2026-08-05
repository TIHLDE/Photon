import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Gammelt lenkeformat: /nyheter/<lepton-id>/<tittel>.
 *
 * Lepton brukte løpenummer, Photon bruker UUID, og migreringen tok ikke vare
 * på den gamle ID-en — det konkrete innholdet kan ikke slås opp. Oversikten er
 * nærmeste treff.
 *
 * To eksplisitte segmenter og ikke en splat: `$slug/$` matcher også
 * `/nyheter/<slug>` alene, siden splat-en kan være tom, og da ble hver ekte
 * detaljside sendt til oversikten.
 */
export const Route = createFileRoute("/_app/nyheter/$slug/$title")({
    beforeLoad: () => {
        throw redirect({ to: "/nyheter", replace: true, statusCode: 301 });
    },
});
