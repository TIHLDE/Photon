import type { GroupTreeInput } from "#/lib/build-group-tree";

export const TREE_MOCK: GroupTreeInput = {
    main: [
        {
            id: "hovedorgan",
            label: "Hovedorgan",
            cols: 2,
            items: [
                {
                    name: "Hovedstyret",
                    leader: "Mads Wasserfall Lillelien",
                    email: "hs@tihlde.org",
                },
                {
                    name: "Forvaltningsgruppen",
                    leader: "Sigurd Evensen",
                    email: "forvalt@tihlde.org",
                },
            ],
        },
        {
            id: "undergrupper",
            label: "Undergrupper",
            cols: 3,
            items: [
                { name: "Beta", leader: "Ola Tjerbo Berg", email: "beta@tihlde.org" },
                { name: "Index", leader: "Mathias Strøm", email: "hovedingeniorsteder@tihlde.org" },
                { name: "Kiosk og Kontor", leader: "Eivind Hansrønnes Fagerhaug", email: "kioskogkontor@tihlde.org" },
                { name: "Næringsliv og Kurs", leader: "Jørgen Øyen Digre", email: "naeringsliv@tihlde.org" },
                { name: "Promo", leader: "Natalie Coates Tvete", email: "promo@tihlde.org" },
                { name: "Sosialen", leader: "John Eliot Holm Finseth", email: "sosialminister@tihlde.org" },
            ],
        },
        {
            id: "komiteer",
            label: "Komitéer",
            cols: 3,
            items: [
                { name: "Drift", leader: "Sofie Sirevåg Tysdal", email: "driftminister@tihlde.org" },
                { name: "FadderKom", leader: "Preben Bugge Angelsnes", email: "fadder@tihlde.org" },
                { name: "IdKom", leader: "Nhiri Halvorsen", email: "idkom@tihlde.org" },
                { name: "JenteKom", leader: "Ole Irene Wang Berntsen", email: "jentekom@tihlde.org" },
                { name: "JubKom", leader: "Nihril Mausvi", email: "jubkom@tihlde.org" },
                { name: "Native", leader: "Mads Nylund", email: "nadpro@gmail.com" },
                { name: "ØkoKom", leader: "Marcus Koranes", email: "okominister@tihlde.org" },
                { name: "Redaksjonen", leader: "Cecilie Silva Børve", email: "redaktor@tihlde.org" },
                { name: "Semikolon", leader: "Cecilie Vu", email: "semikolon@tihlde.org" },
            ],
        },
    ],
    branches: [
        {
            id: "interessegrupper",
            label: "Interessegrupper",
            children: [
                {
                    id: "gruppe",
                    label: "Gruppe",
                    cols: 2,
                    items: [
                        { name: "TIHLDE Plask", leader: "—", email: "plask@tihlde.org" },
                        { name: "TIHLDE Poker", leader: "—", email: "poker@tihlde.org" },
                        { name: "TIHLDE Rett&Vrang", leader: "—", email: "rettogvrang@tihlde.org" },
                        { name: "TIHLDE Smash", leader: "—", email: "smash@tihlde.org" },
                        { name: "TIHLDEpodden", leader: "—", email: "podden@tihlde.org" },
                        { name: "TIHLDE Fotball og F1", leader: "—", email: "fotballf1@tihlde.org" },
                        { name: "TIHLDE Startup", leader: "—", email: "startup@tihlde.org" },
                        { name: "TIHLDE BH", leader: "—", email: "bh@tihlde.org" },
                        { name: "TIHLDE Utveksling", leader: "—", email: "utveksling@tihlde.org" },
                        { name: "Turtorial", leader: "—", email: "turtorial@tihlde.org" },
                    ],
                },
                {
                    id: "idrettsgruppe",
                    label: "Idrettsgruppe",
                    cols: 2,
                    items: [
                        { name: "TIHLDE Basket", leader: "—", email: "basket@tihlde.org" },
                        { name: "TIHLDE Biljard", leader: "—", email: "biljard@tihlde.org" },
                        { name: "TIHLDE Dart", leader: "—", email: "dart@tihlde.org" },
                        { name: "TIHLDE Diskgolf", leader: "—", email: "diskgolf@tihlde.org" },
                        { name: "TIHLDE Klatring", leader: "—", email: "klatring@tihlde.org" },
                        { name: "TIHLDE Spring", leader: "—", email: "spring@tihlde.org" },
                        { name: "TIHLDE Klask", leader: "—", email: "klask@tihlde.org" },
                        { name: "TIHLDE Golf", leader: "—", email: "golf@tihlde.org" },
                        { name: "TIHLDE Ski", leader: "—", email: "ski@tihlde.org" },
                    ],
                },
            ],
        },
        {
            id: "idrettslag",
            label: "Idrettslag",
            cols: 1,
            items: [
                { name: "Pythons Håndball", leader: "—", email: "pythons@tihlde.org" },
                { name: "Pythons Fotball Herrer", leader: "—", email: "pythons@tihlde.org" },
                { name: "Pythons Fotball Damer", leader: "—", email: "pythons@tihlde.org" },
                { name: "Pythons Volley", leader: "—", email: "pythons@tihlde.org" },
            ],
        },
    ],
};
