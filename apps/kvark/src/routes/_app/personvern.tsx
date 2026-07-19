import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";

export const Route = createFileRoute("/_app/personvern")({
    component: PrivacyPolicy,
});

function PrivacyPolicy() {
    return (
        <div className="container mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
            <Card>
                <CardHeader>
                    <CardTitle>Personvernerklæring</CardTitle>
                    <p>Sist oppdatert: Mars 2026</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-8">
                    <section className="flex flex-col gap-4">
                        <h2>1. Behandlingsansvarlig</h2>
                        <p>
                            TIHLDE (Trondheim IngeniørHøgskoles Linjeforening
                            for Dannede EDBere) er behandlingsansvarlig for
                            personopplysninger som samles inn via tihlde.org.
                        </p>
                        <p>
                            Kontakt:{" "}
                            <a href="mailto:hs@tihlde.org">hs@tihlde.org</a>
                        </p>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>2. Hvilke personopplysninger vi samler inn</h2>

                        <div className="flex flex-col gap-2">
                            <h3>2.1 Ved registrering</h3>
                            <ul className="ml-4 list-inside list-disc">
                                <li>Navn (fornavn og etternavn)</li>
                                <li>E-postadresse</li>
                                <li>Brukernavn (Feide-brukernavn)</li>
                                <li>Studieprogram og årskull</li>
                                <li>Kjønn (valgfritt)</li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h3>2.2 Ved bruk av tjenesten</h3>
                            <ul className="ml-4 list-inside list-disc">
                                <li>Profilbilde (valgfritt)</li>
                                <li>
                                    Allergier (ved påmelding til arrangementer
                                    med servering)
                                </li>
                                <li>Gruppemedlemskap</li>
                                <li>Arrangementshistorikk</li>
                                <li>Svar på spørreskjemaer</li>
                                <li>Badges og aktivitetsdata</li>
                                <li>
                                    Bio og annen frivillig profilinformasjon
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h3>2.3 Betalingsopplysninger</h3>
                            <p>
                                Ved betaling for arrangementer behandles
                                betalingen av Vipps AS. Vi lagrer kun
                                informasjon om hvorvidt betaling er gjennomført,
                                ikke betalingsdetaljer som kortnummer eller
                                lignende.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h3>2.4 Automatisk innsamlet informasjon</h3>
                            <p>
                                Vi bruker Vercel Analytics og PostHog for å
                                samle bruksstatistikk og forbedre
                                brukeropplevelsen. PostHog brukes til
                                sesjonsopptak og analyse, men all personlig
                                identifiserbar informasjon (som e-postadresser,
                                navn og andre sensitive data) maskeres
                                automatisk og vises som «*****» i opptakene.
                                Dette sikrer at vi kan analysere brukeratferd
                                uten å lagre personopplysninger.
                            </p>
                        </div>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>3. Formål og rettslig grunnlag</h2>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Formål</TableHead>
                                    <TableHead>
                                        Rettslig grunnlag (GDPR)
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell>Medlemsadministrasjon</TableCell>
                                    <TableCell>
                                        Berettiget interesse (Art. 6(1)(f))
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>
                                        Arrangementsadministrasjon
                                    </TableCell>
                                    <TableCell>Avtale (Art. 6(1)(b))</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Allergihåndtering</TableCell>
                                    <TableCell>
                                        Samtykke (Art. 6(1)(a))
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Bildepublisering</TableCell>
                                    <TableCell>
                                        Samtykke (Art. 6(1)(a))
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Nyhetsbrev/varsler</TableCell>
                                    <TableCell>
                                        Samtykke (Art. 6(1)(a))
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Betalingsbekreftelser</TableCell>
                                    <TableCell>
                                        Avtale og rettslig forpliktelse (Art.
                                        6(1)(b) og (c))
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>4. Deling av personopplysninger</h2>
                        <p>
                            Vi deler personopplysninger med følgende
                            tredjeparter:
                        </p>
                        <ul className="ml-4 list-inside list-disc">
                            <li>
                                <strong>Feide/NTNU:</strong> For autentisering
                                ved innlogging
                            </li>
                            <li>
                                <strong>Vipps AS:</strong> For
                                betalingsbehandling
                            </li>
                            <li>
                                <strong>Vercel:</strong> Hosting og anonymisert
                                analyse
                            </li>
                            <li>
                                <strong>PostHog:</strong> Sesjonsopptak og
                                analyse (persondata maskeres automatisk)
                            </li>
                            <li>
                                <strong>Discord (valgfritt):</strong> Ved
                                kobling av Discord-konto
                            </li>
                        </ul>
                        <p>
                            Vi selger aldri personopplysninger til tredjeparter
                            og deler kun data som er nødvendig for tjenestens
                            funksjon.
                        </p>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>5. Oppbevaring</h2>
                        <ul className="ml-4 list-inside list-disc">
                            <li>
                                <strong>Brukerkontoer:</strong> Så lenge kontoen
                                er aktiv
                            </li>
                            <li>
                                <strong>Arrangementsdata:</strong> 3 år etter
                                arrangementsdato
                            </li>
                            <li>
                                <strong>Betalingsbekreftelser:</strong> 5 år
                                (regnskapskrav)
                            </li>
                            <li>
                                <strong>Botsystem-data:</strong> Så lenge
                                brukeren er medlem av gruppen
                            </li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>6. Dine rettigheter</h2>
                        <p>Du har følgende rettigheter under GDPR:</p>
                        <ul className="ml-4 flex list-inside list-disc flex-col gap-2">
                            <li>
                                <strong>Innsyn:</strong> Du kan eksportere all
                                din data under «Innstillinger» i profilen
                            </li>
                            <li>
                                <strong>Retting:</strong> Du kan redigere din
                                informasjon i profilen
                            </li>
                            <li>
                                <strong>Sletting:</strong> Du kan slette din
                                konto under «Innstillinger» i profilen
                            </li>
                            <li>
                                <strong>Dataportabilitet:</strong> Eksporter din
                                data i maskinlesbart format via profilen
                            </li>
                            <li>
                                <strong>Protest:</strong> Kontakt oss for å
                                protestere mot behandling
                            </li>
                            <li>
                                <strong>Trekke samtykke:</strong> Du kan når som
                                helst endre samtykkeinnstillinger i profilen
                            </li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>7. Informasjonskapsler (cookies)</h2>
                        <p>
                            Vi bruker kun teknisk nødvendige informasjonskapsler
                            for å holde deg innlogget. Disse krever ikke
                            samtykke etter ePrivacy-direktivet.
                        </p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Navn</TableHead>
                                    <TableHead>Formål</TableHead>
                                    <TableHead>Varighet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell>access_token</TableCell>
                                    <TableCell>Autentisering</TableCell>
                                    <TableCell>Sesjonsbasert</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>refresh_token</TableCell>
                                    <TableCell>Fornyet autentisering</TableCell>
                                    <TableCell>30 dager</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>8. Sikkerhet</h2>
                        <p>
                            Vi tar datasikkerhet på alvor og har implementert
                            følgende tiltak:
                        </p>
                        <ul className="ml-4 list-inside list-disc">
                            <li>Kryptert kommunikasjon (HTTPS)</li>
                            <li>Sikker lagring av passord (hashing)</li>
                            <li>Tilgangskontroll basert på roller</li>
                            <li>Regelmessige sikkerhetsoppdateringer</li>
                        </ul>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>9. Kontakt og klage</h2>
                        <p>
                            For spørsmål om personvern eller for å utøve dine
                            rettigheter, kontakt oss på{" "}
                            <a href="mailto:hs@tihlde.org">hs@tihlde.org</a>.
                        </p>
                        <p>
                            Du har også rett til å klage til Datatilsynet:{" "}
                            <a
                                href="https://www.datatilsynet.no"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                www.datatilsynet.no
                            </a>
                        </p>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-4">
                        <h2>10. Endringer</h2>
                        <p>
                            Denne personvernerklæringen kan oppdateres ved
                            behov. Ved vesentlige endringer vil vi informere
                            brukere via e-post eller på nettsiden.
                        </p>
                    </section>
                </CardContent>
            </Card>
        </div>
    );
}
