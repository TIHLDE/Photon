import { createFileRoute, redirect } from "@tanstack/react-router";

/** /kokebok/<studie>/<klasse> og dypere. Se kokebok.$studyId. */
export const Route = createFileRoute("/_app/kokebok/$studyId/$")({
    beforeLoad: () => {
        throw redirect({ to: "/kokebok", replace: true, statusCode: 301 });
    },
});
