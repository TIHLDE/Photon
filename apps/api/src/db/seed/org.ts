import { type DbSchema, schema } from "@photon/db";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { AppContext } from "../../lib/ctx";

/**
 * Seed org-related tables (group, studyProgram, groupMembership, etc.)
 */
export default async ({ db }: AppContext) => {
    const groups = [
        {
            created_at: "2025-09-02 17:49:10.900834",
            updated_at: "2025-09-02 17:49:10.900857",
            image: null,
            name: "TIHLDE Basket",
            slug: "basket",
            description: null,
            contact_email: null,
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
        },
        {
            created_at: "2024-04-30 08:27:52.721960",
            updated_at: "2025-05-04 15:39:15.383325",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/2af88bf7-f86e-4391-9f0f-f54517a102eeBeta%20logo.png",
            name: "Beta",
            slug: "beta",
            description:
                'Beta er en prosjektbasert komité, med selvvalgte prosjekter, og forslag fra _dere_ (send inn ønsker vha. spørreskjemaer). Prosjektene skal i både stor og liten skala bidra til å forbedre linjeforeningen. Vi har i det siste jobbet med å forbedre opptaksprosessen, SoMe-retningslinjer, interessegrupper og intern struktur. \n\nI IT-verden er "Beta" et velkjent begrep som representerer en forbedret versjon eller testversjon før den endelige lanseringen av et produkt.\n\nHar du lyst til å bidra litt _ekstra_ i TIHLDE, søk Beta! Hvis du har noen ideer til prosjekter legg det inn på \n[prosjektforslagsiden vår](https://www.notion.so/tihlde/199eea18864180e087a9c2afff74bedf?v=199eea1886418001b8e5000c485dfbe6&pvs=4)',
            contact_email: "betaleder@tihlde.org",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 0,
        },
        {
            created_at: "2025-09-02 18:21:18.169782",
            updated_at: "2025-09-15 15:30:49.069568",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/283a4160-253f-4117-81c6-017217fffb00IMG_8255.png",
            name: "TIHLDE Biljard",
            slug: "biljard",
            description:
                "**TIHLDE Biljard** er en interessegruppe for folk som er interessert i biljard. Enten man er pro, som leder Lea, eller noob som medlem Elleni. Vi møtes fast månedlig for å spille billiard, lære av hverandre, og ikke minst ha det sosialt og gøy. Gruppen er åpen for alle nivåer, og fokuset er like mye på fellesskapet rundt bordet som på selve spillet <3\n\n\nKontakt lederne Lea og Hannah på mail hvis du har noen spørsmål.",
            contact_email: "biljard@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
        },
        {
            created_at: "2021-04-26 20:06:57.580310",
            updated_at: "2025-04-24 11:46:35.681385",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/a29d981c-5b1e-4b9d-86ee-7e9eabbc6350Beta%20logo%20%281%29.png",
            name: "Drift",
            slug: "drift",
            description:
                "Drift sin oppgave i TIHLDE er å drifte infrastruktur. Det er én ting å kode en applikasjon, men hvordan får du vist denne applikasjonen frem til resten av verden? I Drift lærer du hvordan servere fungerer og hvordan man hoster applikasjoner. Dette er en god mulighet for å lære mer om meget relevante områder i arbeidslivet som man ikke lærer så mye om på skolen.",
            contact_email: "driftsminister@tihlde.org",
            type: "COMMITTEE",
            fine_info:
                "#### **Rettssamfunnets prinsipp**\n- Alle medlemmer er skyldige til det motsatte er bevist.\n- Alle vurderinger skal baseres på skjønn.\n- Alle medlemmer av Drift har lik rett til å dele ut bøter.\n- Alle meldte bøter kan ikke trekkes tilbake på noen annen måte enn gjennom en rettsak.\n- Alle meldte bøter må ha vedlagt en forklaring/årsak for lovbrudd, sammen med bildebevis om mulig.\n\n****\n\n**1 bot ≈ 22 kr** \n\n#### **Botsjef:**\n- Sander “B“ Bratvold \n\n#### **Botfest:**\n- Botsjef vil utsende en handleordre før botfesten for å sikre et variert utvalg varer på botfesten. Handleordenen kan utrettes med forslag fra eller i samarbeid med medlemmene av Drift. \n- Alle medlemmer får en ordre tilsvarende sine antall bøter. Medlemmer kan bytte handleordre innad mellom hverandre så lenge handleordenene fortsatt tilsvarer medlemmene sine antall bøter.  \n- Botfest arrangeres innad i Drift mot slutten av respektivt semester eller ved annen passende anledning. Alle medlemmer plikter å møte opp med varene fra handleordenen utsendt av botsjef. \n- Bøter innkasseres bare på botfest. Dersom et medlem ikke deltar på en botfest, vil medlemmet ikke innkassere bøtene sine og dermed fortsatt ha de frem til de innkasseres ved en senere botfest. \n\n#### **Rettsak**\n- Dommer leser opp siktelsene mot et respektivt medlem av Drift en og en. \n- Dersom to eller flere siktelser gjelder for tilfelle av lovbrudd vil alle siktelsene samles til en samlet siktelse, hvor alle begrunnelsene, bildebevisene og forsvarene er relevante. Siktelsen tilsvarer like mange bøter som siktelsen tilsvarende flest bøter av de sammenslåtte.\n- Enhver siktede har muligheten til å stille seg som uskyldig eller skyldig mot siktelsen etter at dommer har lest opp siktelsen. \n- Dersom den siktede svarer med noe annet enn “skyldig“, “godtatt” eller “klink” etter høyesterett har lest opp siktelsen stiller den siktede seg som uskyldig og tar siktelsen med opp til høyesterett.\n- Aktor kalles opp for utføring av rettsaken, og både aktor og forsvarer presenterer sine saker opp mot siktelsen.\n- Begge parter har maks lov til å kalle på to (2) vitner på hver enkelt sak.\n- Dersom sittende dommer kalles som vitne skal dommer selv bestemme om hen skal vitne eller ikke basert på om hen har noe av relevans å komme med til saken. Dersom dommer bestemmer seg for å vitne stiller dommer seg inhabil og neste person i dommerrekken kalles på for å tre inn som dommer. \n- Under vitneuttalelser kan parten som ikke kalte vitnet utfordre relevansen til vitnet. Dersom høyesterett sier seg enig i utfordringen blir vitneuttalelsen kastet ut av saken. Tapende part i utfordringen blir straffet deretter.\n- Høyesterett avgjør dommen etter at både forsvarer og aktor har presentert sin sak.\n- Dersom en anke leder til at en siktelse blir fjernet eller får antall bøter redusert regnes dette som at anken har fått medhold.\n- Dersom siktede ikke har mulighet til å delta på rettsak, kan den siktede leie inn en forsvars advokat for å representere dem. Innleie av advokat må presenteres skriftlig for høyesteretten før dommer har begynt å lese opp siktelsene rettet mot siktede. \n- Dersom siktede ikke er tilstede på rettsak og ikke har en representant blir siktedes siktelser avgjort av høyesterett dersom det er lagt inn forsvar fra den siktede. Dersom det ikke er lagt inn et forsvar, blir den siktede tiltalt.\n- Dersom siktende ikke har mulighet til å delta på rettsak, kan den siktende leie inn en aktor advokat for å representere dem. Innleie av advokat må presenteres skriftlig for høyesteretten før dommer har begynt å lese opp siktelsene rettet mot siktede.\n- Dersom siktende ikke er tilstede på rettsak og ikke har en representant blir siktendes siktelser avgjort av høyesterett dersom det er lagt inn forklaring/årsak og/eller bildebevis fra den siktende. Dersom det ikke er lagt inn noen forklaring/årsak, blir saken mot den siktede avskjediget.\n- Dersom et tilkalt vitne av enten forsvaret eller aktoratet ikke er tilstede i rettssalen kan vitnet tilkalles digitalt over enten stemme- eller videosamtale. Forsvaret/Aktoratet får et forsøk på å nå vitnet sitt. Hvis vitnet ikke svarer på samtalen på dette forsøket vil vitnet bli avskjediget fra saken selv om vitnet prøver å gjenoppta kontakt senere. \n\nUnder en rettsak fordeles roller som følgende: \n- **Dommer**: Botsjef - Sander “B” Bratvold\n- **Varadommer**: Leder - Stian Closs Walmann\n- **Vara-varadommer**: Nestleder - Borgar Barland\n- **Vara-vara-varadommer**: Høyesteretts utvalgte - Sander Kristian Cornelius Burud Sundbye\n- **Forsvarer**: Siktede/Forsvars advokat\n- **Aktor**: Siktende/Aktor advokat\n\n#### **Endringer**\n- Botsjef har fullmakt til å fritt implementere endringer på lovverket og legge til nye eller fjerne lover opp mot lovverket når som helst, og hvordan som helst.\n- Botsjef kan fortsatt diskutere endringer på lovverket sammen med medlemmer av Drift for meninger eller forslag før implementering om ønskelig.\n- Lederstabben og resten av Drift kan anvende endringer hvis det blir avdekket at endringene strider mot gruppens prinsipper.",
            fines_activated: 1,
        },
        {
            created_at: "2021-04-27 06:26:01.739510",
            updated_at: "2025-04-10 09:10:40.731386",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/4b36e2c5-d5f2-4018-ab52-03d91839113aHS.png",
            name: "Hovedstyret",
            slug: "hs",
            description:
                "Hovedstyret består av Arbeidsutvalget og lederne for undergruppene. Hovedstyret er ansvarlig for driften av linjeforeningen og har ansvaret for å følge opp vedtak fra generalforsamlingen.\n\n# HS-møter\nHovedstyret har jevnlige møter der styret diskuterer og tar opp relevante saker for å forbedre linjeforeningen. Komitéledere og andre relevante medlemmer inviteres også til møtene, slik at styret holdes oppdatert på både stort og smått. Referater fra HS-møter gir TIHLDE medlemmer innsikt i hvilke saker som tas opp og er offentlige for alle medlemmer.\n\n[Referater av HS-møter](https://drive.google.com/drive/folders/1dmZ1uL6EfTA4WSOYH0Bw_2rrAwfgp_Xj?usp=sharing)\n\nØnsker du at hovedstyret skal ta opp saker? Da kan du sende en mail til hs@tihlde.org.  \n**HS-møter holdes hver tirsdag kl 16:15. Ønsker du at saken skal bli tatt opp til kommende HS-møte må du sende inn saken senest 24t før, til hs@tihlde.org**\n\n---\n\n# Arbeidsutvalget\nArbeidsutvalget (AU) består av president, visepresident og finansminister i linjeforeningen. Arbeidsutvalget velges på generalforsamlingen på vårsemesteret og sitter i ett år om gangen. \n\n- **President**: Presidenten av linjeforeningen representerer TIHLDE utad og er den som snakker på vegne av linjeforeningen.  \n- **Visepresident**: Visepresidenten gjør mye administrativt arbeid, er leders høyre hånd og bistår undergrupper og komitéer der det trengs.  \n- **Finansminister**: Finansministeren styrer økonomien og veileder undergruppene om bruk av midlene de får.\n\nArbeidsutvalget har sammen ansvaret for strategi og utvikling av linjeforeningen.\n\n**Arbeidsutvalget:**\n- **President**: Daniel Evensen  \n  Epost: president@tihlde.org  \n- **Visepresident**: Sara Alvestad Kjerstad  \n  Epost: visepresident@tihlde.org  \n- **Finansminister**: Anette Sørnes  \n  Epost: finansminister@tihlde.org  \n\n---\n\n# Undergruppeledere\nHS består også av lederne for undergruppene og tillater sterk representasjon og samarbeid mellom TIHLDEs mest sentrale grupper.\n\n**Undergruppeledere:**\n- **Teknologiminister** (Index): Embret Roås  \n  Epost: teknologiminister@tihlde.org  \n- **Promoteringsminister** (Promo): Thomas Breili Konglevoll  \n  Epost: promominister@tihlde.org \n- **Sosialminister** (Sosialen): Nathalie Graidy Andreassen  \n  Epost: sosialminister@tihlde.org  \n- **Kontorminister** (Kiosk og Kontor): Torkil Thomassen  \n  Epost: kontorminister@tihlde.org  \n- **Næringslivsminister** (Næringsliv og Kurs): Ingrid Marie Nikolaisen  \n  Epost: naeringslivsminister@tihlde.org",
            contact_email: "hs@tihlde.org",
            type: "BOARD",
            fine_info:
                "Bøter for dere jævler/søtnoser\n* En bot = 25kr\n* Botsjef har ansvar for å fiske\n* Botsjef har ansvar for å fikse innkjøpsliste\n* Botsjef er dommer under rettsaken, hen er eneveldig med unntak av bøtene hen er involvert i selv\n* I saker der botsjefen er inhabil skal noen andre være dommer på den saken, dette velges løpenende\n* Tap av rettssak: tiltalte ilegges 1 bot i boten (saksomkostninger)",
            fines_activated: 1,
        },
        {
            created_at: "2020-11-17 13:48:50.630714",
            updated_at: "2024-11-18 16:14:45.216928",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/2a6d6ee8-c928-483b-9c05-000ee6bdbe08Index.png",
            name: "Index",
            slug: "index",
            description:
                "Index jobber smidig med utviklingen av linjeforeningens løsninger, blant annet nettsiden du er inne på akkurat nå.",
            contact_email: "teknologiminister@tihlde.org",
            type: "SUBGROUP",
            fine_info: "Skyldig til motsatt bevist.\n\nForeldring på 1 uke",
            fines_activated: 1,
        },
    ] as const;

    for (const group of groups) {
        const exists = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, group.slug))
            .limit(1);
        if (!exists.length) {
            const newGroup: InferInsertModel<DbSchema["group"]> = {
                name: group.name,
                slug: group.slug,
                description: group.description,
                finesActivated: group.fines_activated === 1,
                finesInfo: group.fine_info,
                type: group.type,
                contactEmail: group.contact_email,
                createdAt: new Date(group.created_at),
                updatedAt: new Date(group.updated_at),
                imageUrl: group.image,
                finesAdminId: null,
            };

            await db.insert(schema.group).values(newGroup);
        }
    }

    // Seed study programs (from org schema)
    await db.insert(schema.studyProgram).values([
        {
            displayName: "Dataingeniør",
            feideCode: "BIDATA",
            slug: "dataingenir",
            type: "bachelor",
        },
        {
            displayName: "Digital Forretningsutvikling",
            feideCode: "ITBAITBEDR",
            slug: "digital-forretningsutvikling",
            type: "bachelor",
        },
        {
            displayName: "Digital Infrastruktur og Cybersikkerhet",
            feideCode: "BDIGSEC",
            slug: "digital-infrastruktur-og-cybersikkerhet",
            type: "bachelor",
        },
        {
            displayName: "Digital Samhandling",
            feideCode: "ITMAIKTSA",
            slug: "digital-samhandling",
            type: "master",
        },
        {
            displayName: "Drift",
            feideCode: "ITBAINFODR",
            slug: "drift-studie",
            type: "bachelor",
        },
        {
            displayName: "Informasjonsbehandling",
            feideCode: "ITBAINFO",
            slug: "informasjonsbehandling",
            type: "bachelor",
        },
    ]);
};
