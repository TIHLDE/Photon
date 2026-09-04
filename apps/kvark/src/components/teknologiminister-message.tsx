import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

const TEKNOLOGIMINISTER = "Teknologiminister";

/**
 * En melding der «Teknologiminister» er en lenke til Index sine medlemmer.
 *
 * API-et ber deg si fra til Teknologiminister når noe bare de kan fikse har
 * gått galt — full lagringsplass, for eksempel. Uten lenka er det et navn du
 * må lete opp selv; med den er det en person du kan kontakte derfra.
 *
 * Splittingen skjer på selve ordet, ikke på en bestemt melding, så enhver
 * feiltekst som nevner vervet får lenka uten at teksten må dupliseres her.
 *
 * Lenka er understreket, ikke bare farget: den står i brødtekst der ingenting
 * annet skiller den ut, og uten understrek leste den som vanlig tekst.
 */
export function TeknologiministerMessage({ message }: { message: string }) {
    const parts = message.split(TEKNOLOGIMINISTER);

    return (
        <>
            {parts.map((part, index) => (
                // Delene har ingen id, og rekkefølgen er gitt av teksten:
                // indeks er den eneste nøkkelen som finnes.
                <Fragment key={index}>
                    {part}
                    {index < parts.length - 1 && (
                        <Link
                            to="/grupper/$slug"
                            params={{ slug: "index" }}
                            search={{ tab: "medlemmer" }}
                            // Understrek i ro, farge på hover — samme som
                            // `Field` og `Empty` gjør med inline-lenker. Det
                            // er også det som holder her: `--link` gir bare
                            // 4.34:1 mot popover-flaten, så i en tooltip må
                            // understreken bære lenka og teksten arve full
                            // kontrast. Se notatet ved --link i styles.css.
                            className="underline underline-offset-4 hover:text-link"
                        >
                            {TEKNOLOGIMINISTER}
                        </Link>
                    )}
                </Fragment>
            ))}
        </>
    );
}
