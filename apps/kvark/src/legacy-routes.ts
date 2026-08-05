/**
 * Redirects fra URL-ene den gamle tihlde.org-frontenden brukte.
 *
 * Når tihlde.org peker på denne appen, arver vi alle lenkene som ligger ute
 * fra før: Google-treff, Discord-meldinger, e-poster, Facebook-innlegg. Uten
 * disse reglene blir de 404.
 *
 * Tre grupper:
 *
 * 1. Ruter som bare har byttet navn (`/logg-inn` → `/login`). Her lander
 *    brukeren nøyaktig der hen skulle.
 * 2. Funksjoner som ikke er portet (badges, korte lenker, tilbakemelding).
 *    De går til forsiden.
 *
 * Innholdslenker med gammel Lepton-ID (`/arrangementer/1234/julebord`) hører
 * også hjemme her, men ligger som splat-ruter under `src/routes/` i stedet.
 * Mønstrene her er ikke segmentpresise: `/arrangementer/*` treffer også
 * `/arrangementer` selv og ekte detaljsider, altså en redirect-løkke over hele
 * arrangementssiden. Routeren skiller `$slug` fra `$slug/$` eksakt.
 *
 * 301 og ikke 302: adressene kommer aldri tilbake, og søkemotorer skal flytte
 * rankingen over på den nye URL-en.
 */

type RedirectRule = { redirect: { to: string; status: 301 } };

function to(target: string): RedirectRule {
    return { redirect: { to: target, status: 301 } };
}

export const legacyRouteRules: Record<string, RedirectRule> = {
    // --- Ruter som har byttet navn ---------------------------------------
    "/logg-inn": to("/login"),
    "/glemt-passord": to("/forgot-password"),
    "/ny-bruker": to("/register"),
    "/ny-bruker/**": to("/register"),
    "/stillingsannonser": to("/annonser"),
    "/bedrifter": to("/bedrift"),
    "/bedrifter/**": to("/bedrift"),
    // Interessegrupper er ikke borte, de er en gruppetype som vises under
    // /grupper. Bare den eneadresserte siden er det.
    "/interessegrupper": to("/grupper"),
    // Gammel URL uten ID betydde «min profil». /profil/me er aliaset som
    // grupper.$slug-siden og menyene bruker for det samme.
    "/profil": to("/profil/me"),
    "/stillingsannonser/**": to("/annonser"),

    // --- Funksjoner som ikke er portet ------------------------------------
    "/badges": to("/"),
    "/badges/**": to("/"),
    "/tilbakemelding": to("/"),
    "/linker": to("/"),
    "/endringslogg": to("/"),
};
