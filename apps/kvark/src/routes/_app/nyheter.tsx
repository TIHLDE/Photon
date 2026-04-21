import { createFileRoute } from "@tanstack/react-router";

import { NewsCard, type NewsCardProps } from "#/components/news-card";

export const Route = createFileRoute("/_app/nyheter")({ component: NewsPage });

const NEWS: NewsCardProps[] = [
    {
        title: "How to Notion",
        excerpt:
            "Opplæring til Promo? Bruk Notion! Les vår nye guide om hvordan vi bruker Notion i undergrupper.",
        publishedAt: "Oppdatert i går",
    },
    {
        title: "TIHLDE Trivselsundersøkelse V26",
        excerpt:
            "Vinn gavekort ved å svare på den årlige trivselsundersøkelsen. Din stemme teller!",
        publishedAt: "3 dager siden",
    },
    {
        title: "Aten Scholarship",
        excerpt:
            "Søk om stipend til å delta på konferanser og workshops gjennom Aten.",
        publishedAt: "4 dager siden",
    },
    {
        title: "Klatring i TIHLDE",
        excerpt:
            "Bli med på klatrekvelder sammen med andre TIHLDE-medlemmer. Alle nivåer velkomne!",
        publishedAt: "1 uke siden",
    },
    {
        title: "Snart Generalforsamling",
        excerpt:
            "Generalforsamling for TIHLDE nærmer seg. Les mer om saksliste og hvordan du stemmer.",
        publishedAt: "1 uke siden",
    },
    {
        title: "Kommende TIHLDElab internasjonale Filmkveld",
        excerpt:
            "TIHLDElab inviterer til internasjonal filmkveld i Hangaren. Snacks og drikke blir servert.",
        publishedAt: "2 uker siden",
    },
    {
        title: "Forslag til arrangementer til neste år",
        excerpt:
            "Vi ønsker innspill fra medlemmer om hva dere vil se av arrangementer neste semester.",
        publishedAt: "2 uker siden",
    },
    {
        title: "Godt nyttår fra HS!",
        excerpt:
            "Hovedstyret ønsker alle medlemmer et riktig godt nyttår og ser frem til et spennende år.",
        publishedAt: "3 uker siden",
    },
    {
        title: "HSHD Sep 25",
        excerpt: "Referat fra Hovedstyrets dag i september 2025.",
        publishedAt: "1 måned siden",
    },
    {
        title: "Kit trengen i TV fra TIHLDE",
        excerpt:
            "TIHLDE er på jakt etter nye medlemmer til TV-gruppa. Interessert?",
        publishedAt: "1 måned siden",
    },
    {
        title: "Oppstart til FadderStyret 22/26",
        excerpt:
            "Fadderstyret for neste års fadderuke har hatt oppstartssamling. Les mer her.",
        publishedAt: "1 måned siden",
    },
    {
        title: "Søk velferdsmidler nå!",
        excerpt:
            "Interessegrupper kan søke om velferdsmidler fra TIHLDE. Fristen nærmer seg.",
        publishedAt: "1 måned siden",
    },
];

function NewsPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Nyheter</h1>
                <p className="text-muted-foreground">
                    Siste nytt fra TIHLDE og undergruppene
                </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {NEWS.map((item) => (
                    <li key={item.title}>
                        <NewsCard {...item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
