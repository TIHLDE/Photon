import { createFileRoute, notFound } from "@tanstack/react-router";

/**
 * Fanger adresser som ikke treffer noen rute. Uten den havner 404-en på
 * rot-ruta, utenfor `_app`, og da vises den naken uten header og footer —
 * altså uten noen av lenkene folk trenger for å komme seg videre.
 *
 * Selve visningen er routerens `defaultNotFoundComponent`, så den er lik her
 * som for `notFound()` kastet fra en loader.
 */
export const Route = createFileRoute("/_app/$")({
    loader: () => {
        throw notFound();
    },
});
