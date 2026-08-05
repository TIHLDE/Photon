import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Gammelt lenkeformat: /arrangementer/<lepton-id>/<tittel>.
 *
 * Lepton brukte løpenummer, Photon bruker UUID, og migreringen tok ikke vare
 * på den gamle ID-en — det konkrete innholdet kan ikke slås opp. Oversikten er
 * nærmeste treff.
 *
 * To eksplisitte segmenter og ikke en splat: `$slug/$` matcher også
 * `/arrangementer/<slug>` alene, siden splat-en kan være tom, og da ble hver ekte
 * detaljside sendt til oversikten.
 */
export const Route = createFileRoute("/_app/arrangementer/$slug/$title")({
    beforeLoad: () => {
        throw redirect({
            to: "/arrangementer",
            replace: true,
            statusCode: 301,
        });
    },
});
