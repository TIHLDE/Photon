import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Gammelt lenkeformat: /galleri/<lepton-id>/<tittel>.
 *
 * Lepton brukte løpenummer, Photon bruker UUID, og migreringen tok ikke vare
 * på den gamle ID-en — det konkrete innholdet kan ikke slås opp. Oversikten er
 * nærmeste treff.
 *
 * To eksplisitte segmenter og ikke en splat: `$slug/$` matcher også
 * `/galleri/<slug>` alene, siden splat-en kan være tom, og da ble hver ekte
 * detaljside sendt til oversikten.
 */
export const Route = createFileRoute("/_app/galleri/$slug/$title")({
    beforeLoad: () => {
        throw redirect({ to: "/galleri", replace: true, statusCode: 301 });
    },
});
