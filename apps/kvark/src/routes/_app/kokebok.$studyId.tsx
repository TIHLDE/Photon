import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Kokeboken tok studie og klasse i URL-en (/kokebok/<studie>/<klasse>); nå
 * velges de på siden selv.
 *
 * Eksplisitte parametersegmenter og ikke en splat: `/kokebok/$` matcher også
 * `/kokebok` selv, siden splat-en kan være tom — det ble en redirect-løkke på
 * selve kokeboksiden.
 */
export const Route = createFileRoute("/_app/kokebok/$studyId")({
    beforeLoad: () => {
        throw redirect({ to: "/kokebok", replace: true, statusCode: 301 });
    },
});
