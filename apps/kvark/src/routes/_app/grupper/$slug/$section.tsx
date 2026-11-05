import { createFileRoute, redirect } from "@tanstack/react-router";

// Unknown sections and the former /om address lead to the group overview.
export const Route = createFileRoute("/_app/grupper/$slug/$section")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/grupper/$slug",
            params: { slug: params.slug },
            replace: true,
        });
    },
});
