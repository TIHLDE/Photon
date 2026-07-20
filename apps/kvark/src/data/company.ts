import { addMonths } from "date-fns";

/**
 * Content for the "for bedrifter" pages, migrated from the standalone
 * bedrift.tihlde.org site. Owned by Næringsliv og kurs — edit here.
 */

export const COMPANY_OFFERS = [
    {
        title: "Bedriftspresentasjoner",
        description:
            "En bedriftspresentasjon lar dere introdusere organisasjonen for TIHLDE-studentene, vise hva dere tilbyr og hvordan dere jobber. Etter presentasjonen følger middag og mingling med bedriftsrepresentanter.",
        imageUrl: "/bedrift/bedriftspresentasjon.jpeg",
    },
    {
        title: "Kurs og workshop",
        description:
            "Et kurs introduserer studentene for relevante faglige erfaringer til arbeidslivet. Det kan for eksempel være en spennende case, kodekurs, eller capture the flag. Dere kan tilpasse innholdet etter hvilke studenter som kommer. Vi legger til rette for matservering på skolen eller restaurantbesøk etter kurset.",
        imageUrl: "/bedrift/kurs-workshop.jpeg",
    },
    {
        title: "Bedriftsbesøk",
        description:
            "Under et bedriftsbesøk besøker studentene deres lokaler for et valgfritt arrangement. Dette gir dere en mulighet til å vise frem arbeidsplassen og bli bedre kjent med dem.",
        imageUrl: "/bedrift/bedriftsbesok.jpeg",
    },
    {
        title: "Bedriftsekskursjon til Oslo",
        description:
            "Hver høst arrangerer TIHLDE en bedriftsekskursjon til Oslo med 30 studenter. Dette gir bedrifter en god mulighet å vise frem lokalene sine og vise hvordan en typisk arbeidsdag hos dem ser ut. Etter besøket legger vi til rette for bespisning og mingling.",
        imageUrl: "/bedrift/bedriftsekskursjon.jpg",
    },
] as const;

export const TIHLDE_DESCRIPTION =
    "TIHLDE (Trondheim IngeniørHøgskoles Linjeforening for Dannede EDBere) er linjeforeningen for bachelorstudiene Dataingeniør, Digital infrastruktur og cybersikkerhet, Digital forretningsutvikling, Informasjonsbehandling samt masterstudiet Digital transformasjon ved AIT, IDI, IIK NTNU på Gløshaugen.";

/** Short blurbs used on the company landing page */
export const STUDY_PROGRAMMES_SHORT = [
    {
        title: "Digital forretningsutvikling",
        description:
            "I krysningen mellom informatikk, økonomi, marked, organisasjon og ledelse møter du de som studerer digital forretningsutvikling.",
    },
    {
        title: "Digital infrastruktur og cybersikkerhet",
        description:
            "Studiet kombinerer informatikk med praktiske ferdigheter innen digital infrastruktur og sikkerhet.",
    },
    {
        title: "Dataingeniør",
        description:
            "Studiet gir et solid grunnlag for systemutvikling av digitale løsninger, med fokus på funksjonalitet, sikkerhet og brukertilpasning.",
    },
    {
        title: "Digital transformasjon",
        description:
            "Studiet gir avansert kompetanse i digital transformasjon, med fokus på hvordan virksomheter kan utnytte digitale teknologier for strategisk utvikling og effektivisering.",
    },
] as const;

/** Full descriptions used on the dedicated studies page */
export const STUDY_PROGRAMMES = [
    {
        title: "Digital forretningsutvikling",
        description:
            "Digital forretningsutvikling kombinerer IT, økonomi og ledelse for å skape forretningsutviklere med tverrfaglig kompetanse. For at samfunnet skal digitaliseres er det nødvendig med ledere som har både teknisk og økonomisk kompetanse. Digital forretningsutvikling er lagt opp med høyt fokus på praktisk erfaring innenfor teamarbeid og kommunikasjon. Studiet søker å utdanne dyktige endringsagenter som kan effektivisere arbeidsprosesser og implementere digitale løsninger i bedrifter.",
    },
    {
        title: "Dataingeniør",
        description:
            "Dataingeniør-studiet kombinerer det beste fra de spesialiserte informatikkutdanningene og de tradisjonelle ingeniørutdanningene. Det legger mye vekt på praktisk utvikling av systemer og programmer, og studentene får et godt grunnlag i datateknikk, matematikk og teknisk-naturvitenskapelige fag, samt varig og verdifull kompetanse om hvordan datateknikk kan benyttes.",
    },
    {
        title: "Digital infrastruktur og cybersikkerhet",
        description:
            "Dette bachelorstudiet setter fokus på den drift-tekniske IKT-kompetansen bedrifter etterspør. Studentene lærer planleggingsprosesser og oppsett av virtuelle maskiner med bruk av teknologier som VMWare og HyperV. Videre temaer i studiet er Linux, Windows Server, «Cloud Computing» og overvåkning og sikkerhet i digital infrastruktur.",
    },
    {
        title: "Digital transformasjon",
        description:
            "Digital transformasjon er et veletablert forskningsområde som tar for seg hvordan utøvelse og koordinering av samarbeidsaktiviteter kan støttes ved hjelp av ulike IKT-systemer. Studentene ved denne 2 årige masteren er i stand til å samhandle effektivt i forskjellige tverrfaglige problemløsningsprosesser.",
    },
] as const;

export const COMPANY_EVENT_TYPES = [
    "Bedriftspresentasjon",
    "Kurs/Workshop",
    "Bedriftsbesøk",
    "Annonse",
    "Insta-takeover",
    "Bedriftsekskursjon",
    "Annet",
] as const;

/**
 * The next `count` semesters, starting from the one a month out — companies
 * plan ahead, and the current semester is effectively booked by the time
 * they reach the form.
 */
export function upcomingSemesters(count = 4, from: Date = new Date()) {
    const start = addMonths(from, 1);

    return Array.from({ length: count }, (_, index) => {
        let month = start.getMonth() + index * 6;
        let year = start.getFullYear();
        while (month > 11) {
            month -= 12;
            year++;
        }
        return `${month > 5 ? "Høst" : "Vår"} ${year}`;
    });
}
