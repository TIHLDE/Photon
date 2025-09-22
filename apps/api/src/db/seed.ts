import db, { type DbSchema, schema } from "../db";

import { auth } from "../lib/auth";
import { eq, type InferInsertModel } from "drizzle-orm";

export default async () => {
    // Check if any users exist
    const studyGroupCount = await db
        .select()
        .from(schema.studyProgram)
        .limit(1)
        .then((rows) => rows.length);

    const firstRun = studyGroupCount === 0;
    // await seed(db, schema, { count: 10 });

    if (firstRun) {
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
    }

    // Seed RBAC defaults
    const [adminRole] = await db
        .insert(schema.role)
        .values({ name: "admin", description: "Administrator", position: 1 })
        .onConflictDoNothing()
        .returning();
    const [eventsCreate] = await db
        .insert(schema.permission)
        .values({ name: "events:create", description: "Create events" })
        .onConflictDoNothing()
        .returning();
    const [eventsUpdate] = await db
        .insert(schema.permission)
        .values({ name: "events:update", description: "Update events" })
        .onConflictDoNothing()
        .returning();
    const [eventsDelete] = await db
        .insert(schema.permission)
        .values({ name: "events:delete", description: "Delete events" })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsList] = await db
        .insert(schema.permission)
        .values({
            name: "events:registrations:list",
            description: "List event registrations",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsCheckin] = await db
        .insert(schema.permission)
        .values({
            name: "events:registrations:checkin",
            description: "Check-in users to events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackList] = await db
        .insert(schema.permission)
        .values({
            name: "events:feedback:list",
            description: "List feedback for events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsList] = await db
        .insert(schema.permission)
        .values({
            name: "events:payments:list",
            description: "List payments for events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsCreate] = await db
        .insert(schema.permission)
        .values({
            name: "events:payments:create",
            description: "Create event payment records",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsGet] = await db
        .insert(schema.permission)
        .values({
            name: "events:payments:get",
            description: "Get a single payment",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsUpdate] = await db
        .insert(schema.permission)
        .values({
            name: "events:payments:update",
            description: "Update a payment record",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsDelete] = await db
        .insert(schema.permission)
        .values({
            name: "events:payments:delete",
            description: "Delete a payment record",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsGet] = await db
        .insert(schema.permission)
        .values({
            name: "events:registrations:get",
            description: "Get a single registration",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsCreate] = await db
        .insert(schema.permission)
        .values({
            name: "events:registrations:create",
            description: "Admin create registration for a user",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsDelete] = await db
        .insert(schema.permission)
        .values({
            name: "events:registrations:delete",
            description: "Admin delete registration",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackGet] = await db
        .insert(schema.permission)
        .values({
            name: "events:feedback:get",
            description: "Get a single feedback",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackUpdate] = await db
        .insert(schema.permission)
        .values({
            name: "events:feedback:update",
            description: "Update feedback",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackDelete] = await db
        .insert(schema.permission)
        .values({
            name: "events:feedback:delete",
            description: "Delete feedback",
        })
        .onConflictDoNothing()
        .returning();
    if (adminRole) {
        for (const p of [
            eventsCreate,
            eventsUpdate,
            eventsDelete,
            eventsRegistrationsList,
            eventsRegistrationsCheckin,
            eventsRegistrationsGet,
            eventsRegistrationsCreate,
            eventsRegistrationsDelete,
            eventsFeedbackList,
            eventsFeedbackGet,
            eventsFeedbackUpdate,
            eventsFeedbackDelete,
            eventsPaymentsList,
            eventsPaymentsCreate,
            eventsPaymentsGet,
            eventsPaymentsUpdate,
            eventsPaymentsDelete,
        ]) {
            if (!p) continue;
            await db
                .insert(schema.rolePermission)
                .values({ roleId: adminRole.id, permissionId: p.id })
                .onConflictDoNothing();
        }
    }

    const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, "test@test.com"))
        .limit(1);

    if (!users.length) {
        await auth.api.createUser({
            body: {
                email: "test@test.com",
                password: "index123",
                name: "Brotherman Testern",
                role: "admin",
            },
        });
    }

    const groups = [
        {
            created_at: "2022-03-10 16:55:37.622153",
            updated_at: "2022-03-10 16:55:37.622195",
            image: null,
            image_alt: null,
            name: "2017",
            slug: "2017",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:36.918456",
            updated_at: "2022-03-10 16:55:36.918520",
            image: null,
            image_alt: null,
            name: "2018",
            slug: "2018",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.254282",
            updated_at: "2022-03-10 16:55:37.254344",
            image: null,
            image_alt: null,
            name: "2019",
            slug: "2019",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.147078",
            updated_at: "2022-03-10 16:55:37.147124",
            image: null,
            image_alt: null,
            name: "2020",
            slug: "2020",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.009823",
            updated_at: "2022-03-10 16:55:37.009873",
            image: null,
            image_alt: null,
            name: "2021",
            slug: "2021",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-07-10 10:57:09.299876",
            updated_at: "2022-07-10 10:57:09.299908",
            image: null,
            image_alt: null,
            name: "2022",
            slug: "2022",
            description: "",
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2023-07-10 11:52:20.102704",
            updated_at: "2024-07-04 13:31:14.292354",
            image: null,
            image_alt: null,
            name: "2023",
            slug: "2023",
            description: "",
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2024-07-04 13:31:26.465308",
            updated_at: "2024-07-04 13:31:26.465327",
            image: null,
            image_alt: null,
            name: "2024",
            slug: "2024",
            description: "",
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2025-07-21 10:51:23.047711",
            updated_at: "2025-07-21 10:51:23.047728",
            image: null,
            image_alt: null,
            name: "2025",
            slug: "2025",
            description: null,
            contact_email: null,
            type: "STUDYYEAR",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2025-09-02 17:49:10.900834",
            updated_at: "2025-09-02 17:49:10.900857",
            image: null,
            image_alt: null,
            name: "TIHLDE Basket",
            slug: "basket",
            description: null,
            contact_email: null,
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2024-04-30 08:27:52.721960",
            updated_at: "2025-05-04 15:39:15.383325",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/2af88bf7-f86e-4391-9f0f-f54517a102eeBeta%20logo.png",
            image_alt: "Beta",
            name: "Beta",
            slug: "beta",
            description:
                'Beta er en prosjektbasert komité, med selvvalgte prosjekter, og forslag fra _dere_ (send inn ønsker vha. spørreskjemaer). Prosjektene skal i både stor og liten skala bidra til å forbedre linjeforeningen. Vi har i det siste jobbet med å forbedre opptaksprosessen, SoMe-retningslinjer, interessegrupper og intern struktur. \n\nI IT-verden er "Beta" et velkjent begrep som representerer en forbedret versjon eller testversjon før den endelige lanseringen av et produkt.\n\nHar du lyst til å bidra litt _ekstra_ i TIHLDE, søk Beta! Hvis du har noen ideer til prosjekter legg det inn på \n[prosjektforslagsiden vår](https://www.notion.so/tihlde/199eea18864180e087a9c2afff74bedf?v=199eea1886418001b8e5000c485dfbe6&pvs=4)',
            contact_email: "betaleder@tihlde.org",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2025-09-02 18:21:18.169782",
            updated_at: "2025-09-15 15:30:49.069568",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/283a4160-253f-4117-81c6-017217fffb00IMG_8255.png",
            image_alt: null,
            name: "TIHLDE Biljard",
            slug: "biljard",
            description:
                "**TIHLDE Biljard** er en interessegruppe for folk som er interessert i biljard. Enten man er pro, som leder Lea, eller noob som medlem Elleni. Vi møtes fast månedlig for å spille billiard, lære av hverandre, og ikke minst ha det sosialt og gøy. Gruppen er åpen for alle nivåer, og fokuset er like mye på fellesskapet rundt bordet som på selve spillet <3\n\n\nKontakt lederne Lea og Hannah på mail hvis du har noen spørsmål.",
            contact_email: "biljard@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.649356",
            updated_at: "2022-03-10 16:55:37.649405",
            image: null,
            image_alt: null,
            name: "Dataingeniør",
            slug: "dataingenir",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.816762",
            updated_at: "2022-03-10 16:55:37.816810",
            image: null,
            image_alt: null,
            name: "Digital forretningsutvikling",
            slug: "digital-forretningsutvikling",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.921469",
            updated_at: "2022-03-10 16:55:37.921514",
            image: null,
            image_alt: null,
            name: "Digital infrastruktur og cybersikkerhet",
            slug: "digital-infrastruktur-og-cybersikkerhet",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-10 16:55:37.991708",
            updated_at: "2024-02-09 09:17:12.410404",
            image: null,
            image_alt: null,
            name: "Digital transformasjon",
            slug: "digital-samhandling",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2025-08-12 15:09:39.841623",
            updated_at: "2025-08-14 13:33:10.250220",
            image: null,
            image_alt: null,
            name: "Digital Transformasjon",
            slug: "digitaltransformasjonfaddergruppe",
            description: "",
            contact_email: "madsnyl@gmail.com",
            type: "PRIVATE",
            fine_info: "",
            fines_activated: 1,
            fines_admin_id: "eirielv",
        },
        {
            created_at: "2021-04-26 20:06:57.580310",
            updated_at: "2025-04-24 11:46:35.681385",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/a29d981c-5b1e-4b9d-86ee-7e9eabbc6350Beta%20logo%20%281%29.png",
            image_alt: null,
            name: "Drift",
            slug: "drift",
            description:
                "Drift sin oppgave i TIHLDE er å drifte infrastruktur. Det er én ting å kode en applikasjon, men hvordan får du vist denne applikasjonen frem til resten av verden? I Drift lærer du hvordan servere fungerer og hvordan man hoster applikasjoner. Dette er en god mulighet for å lære mer om meget relevante områder i arbeidslivet som man ikke lærer så mye om på skolen.",
            contact_email: "driftsminister@tihlde.org",
            type: "COMMITTEE",
            fine_info:
                "#### **Rettssamfunnets prinsipp**\n- Alle medlemmer er skyldige til det motsatte er bevist.\n- Alle vurderinger skal baseres på skjønn.\n- Alle medlemmer av Drift har lik rett til å dele ut bøter.\n- Alle meldte bøter kan ikke trekkes tilbake på noen annen måte enn gjennom en rettsak.\n- Alle meldte bøter må ha vedlagt en forklaring/årsak for lovbrudd, sammen med bildebevis om mulig.\n\n****\n\n**1 bot ≈ 22 kr** \n\n#### **Botsjef:**\n- Sander “B“ Bratvold \n\n#### **Botfest:**\n- Botsjef vil utsende en handleordre før botfesten for å sikre et variert utvalg varer på botfesten. Handleordenen kan utrettes med forslag fra eller i samarbeid med medlemmene av Drift. \n- Alle medlemmer får en ordre tilsvarende sine antall bøter. Medlemmer kan bytte handleordre innad mellom hverandre så lenge handleordenene fortsatt tilsvarer medlemmene sine antall bøter.  \n- Botfest arrangeres innad i Drift mot slutten av respektivt semester eller ved annen passende anledning. Alle medlemmer plikter å møte opp med varene fra handleordenen utsendt av botsjef. \n- Bøter innkasseres bare på botfest. Dersom et medlem ikke deltar på en botfest, vil medlemmet ikke innkassere bøtene sine og dermed fortsatt ha de frem til de innkasseres ved en senere botfest. \n\n#### **Rettsak**\n- Dommer leser opp siktelsene mot et respektivt medlem av Drift en og en. \n- Dersom to eller flere siktelser gjelder for tilfelle av lovbrudd vil alle siktelsene samles til en samlet siktelse, hvor alle begrunnelsene, bildebevisene og forsvarene er relevante. Siktelsen tilsvarer like mange bøter som siktelsen tilsvarende flest bøter av de sammenslåtte.\n- Enhver siktede har muligheten til å stille seg som uskyldig eller skyldig mot siktelsen etter at dommer har lest opp siktelsen. \n- Dersom den siktede svarer med noe annet enn “skyldig“, “godtatt” eller “klink” etter høyesterett har lest opp siktelsen stiller den siktede seg som uskyldig og tar siktelsen med opp til høyesterett.\n- Aktor kalles opp for utføring av rettsaken, og både aktor og forsvarer presenterer sine saker opp mot siktelsen.\n- Begge parter har maks lov til å kalle på to (2) vitner på hver enkelt sak.\n- Dersom sittende dommer kalles som vitne skal dommer selv bestemme om hen skal vitne eller ikke basert på om hen har noe av relevans å komme med til saken. Dersom dommer bestemmer seg for å vitne stiller dommer seg inhabil og neste person i dommerrekken kalles på for å tre inn som dommer. \n- Under vitneuttalelser kan parten som ikke kalte vitnet utfordre relevansen til vitnet. Dersom høyesterett sier seg enig i utfordringen blir vitneuttalelsen kastet ut av saken. Tapende part i utfordringen blir straffet deretter.\n- Høyesterett avgjør dommen etter at både forsvarer og aktor har presentert sin sak.\n- Dersom en anke leder til at en siktelse blir fjernet eller får antall bøter redusert regnes dette som at anken har fått medhold.\n- Dersom siktede ikke har mulighet til å delta på rettsak, kan den siktede leie inn en forsvars advokat for å representere dem. Innleie av advokat må presenteres skriftlig for høyesteretten før dommer har begynt å lese opp siktelsene rettet mot siktede. \n- Dersom siktede ikke er tilstede på rettsak og ikke har en representant blir siktedes siktelser avgjort av høyesterett dersom det er lagt inn forsvar fra den siktede. Dersom det ikke er lagt inn et forsvar, blir den siktede tiltalt.\n- Dersom siktende ikke har mulighet til å delta på rettsak, kan den siktende leie inn en aktor advokat for å representere dem. Innleie av advokat må presenteres skriftlig for høyesteretten før dommer har begynt å lese opp siktelsene rettet mot siktede.\n- Dersom siktende ikke er tilstede på rettsak og ikke har en representant blir siktendes siktelser avgjort av høyesterett dersom det er lagt inn forklaring/årsak og/eller bildebevis fra den siktende. Dersom det ikke er lagt inn noen forklaring/årsak, blir saken mot den siktede avskjediget.\n- Dersom et tilkalt vitne av enten forsvaret eller aktoratet ikke er tilstede i rettssalen kan vitnet tilkalles digitalt over enten stemme- eller videosamtale. Forsvaret/Aktoratet får et forsøk på å nå vitnet sitt. Hvis vitnet ikke svarer på samtalen på dette forsøket vil vitnet bli avskjediget fra saken selv om vitnet prøver å gjenoppta kontakt senere. \n\nUnder en rettsak fordeles roller som følgende: \n- **Dommer**: Botsjef - Sander “B” Bratvold\n- **Varadommer**: Leder - Stian Closs Walmann\n- **Vara-varadommer**: Nestleder - Borgar Barland\n- **Vara-vara-varadommer**: Høyesteretts utvalgte - Sander Kristian Cornelius Burud Sundbye\n- **Forsvarer**: Siktede/Forsvars advokat\n- **Aktor**: Siktende/Aktor advokat\n\n#### **Endringer**\n- Botsjef har fullmakt til å fritt implementere endringer på lovverket og legge til nye eller fjerne lover opp mot lovverket når som helst, og hvordan som helst.\n- Botsjef kan fortsatt diskutere endringer på lovverket sammen med medlemmer av Drift for meninger eller forslag før implementering om ønskelig.\n- Lederstabben og resten av Drift kan anvende endringer hvis det blir avdekket at endringene strider mot gruppens prinsipper.",
            fines_activated: 1,
            fines_admin_id: "sandbra",
        },
        {
            created_at: "2022-03-10 16:55:38.019103",
            updated_at: "2022-03-10 16:55:38.019148",
            image: null,
            image_alt: null,
            name: "Drift (studie)",
            slug: "drift-studie",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2020-11-17 13:52:25.134382",
            updated_at: "2025-03-05 15:18:04.562326",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/1c527227-728e-4f3a-b373-ee215214562a3.png",
            image_alt: null,
            name: "FadderKom",
            slug: "fadderkom",
            description:
                "Fadderkomiteen har ansvar for planlegning og gjennomføring av fadderuken for alle linjer som er knyttet til TIHLDE-linjeforening. Fadderuken er et svært viktig tiltak for at de nye studentene skal få best mulig start på sin studietid ved NTNU, og ikke minst for at studentene skal kunne bli kjent med sine medstudenter, skolen og Trondheim. Komiteen har et styre som tar seg av det administrative og vanlige komiteemedlemmer som tar seg av selve arrangement-planlegningen.",
            contact_email: "fadderstyret@tihlde.org",
            type: "COMMITTEE",
            fine_info:
                "All ufin omgang straffes under en lav sko!\n\n**Hvordan fungerer botsystemet?**\n\nDet er et lovverk som vi medlemmer må forholde oss til. Brytes lovverket blir det opprettet en sak(bot). Etter fadderuka blir det hold en rettsak, denne rettsaken er for at det er muligheter for å forsvare seg.\n\n§0.01 - Prinsipp 1\nEnhver person er skyldig inntil det motsatte er bevist.\n\n§0.02 - Prinsipp 2\nAlle vurderinger skal baseres på skjønn.",
            fines_activated: 1,
            fines_admin_id: "sandbra",
        },
        {
            created_at: "2024-08-18 19:28:42.359951",
            updated_at: "2024-08-18 19:31:04.544727",
            image: null,
            image_alt: null,
            name: "Fondsforvalter",
            slug: "fondsforvalter",
            description: "",
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-24 19:05:22.167618",
            updated_at: "2025-03-19 12:46:38.554781",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/f50ea58e-4782-4fcb-a7df-b0bcea18e0a2Fondet.png",
            image_alt: null,
            name: "Forvaltningsgruppen",
            slug: "forvaltningsgruppen",
            description:
                "Formålet til TIHLDE-fondet er å forvalte oppsparte midler på en hensiktsmessig måte og i TIHLDEs beste interesse gjennom å investere i ulike aksjefond. Fondet vil også ta innspill fra TIHLDEs medlemmer om forslag til innkjøp som ikke blir budsjettert. Dette kan være alt fra små investeringer som en ny kaffetrakter til større investeringer som en egen TIHLDE-kjeller.\n\nFondet har totalt 12 medlemmer og består av:\n1 Fondsforvalter\n1 fra De Eldstes Raad\n10 Ordinære medlemmer\n\nNettside: [https://fondet.tihlde.org/](https://fondet.tihlde.org/)",
            contact_email: "fondet@tihlde.org",
            type: "BOARD",
            fine_info:
                "Prikkereglement for TIHLDE-fondet 2024.\n\nTIHLDE-fondets prikkreglement er utviklet for å sikre kvalitet og effektivitet i fondets arbeid, samt bidra til å sørge for tilstrekkelig og god promille under fondets mangfoldige sosiale tilstelninger. \n\nAlle medlemmer har ansvar for å dele ut bøter om lovbrudd bevitnes. \n\nEndelig straffeutmåling vedtas ved rettssak, som skal gjennomføres før botfest.",
            fines_activated: 1,
            fines_admin_id: "erikklan",
        },
        {
            created_at: "2024-10-22 13:37:51.725748",
            updated_at: "2025-04-03 15:07:35.563874",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/6034b813-5360-49e2-89bc-067f397a0d7dpythons%20logo.jpeg",
            image_alt: null,
            name: "Pythons Håndball",
            slug: "handball",
            description:
                "## Håndball-gruppa for alle TIHLDEs medlemmer!\n\nEnten om du er aktiv håndballspiller eller det har gått såpass mange år at du har glemt hvor drit det er med alle blemmene, så er du selvfølgelig velkommen hos oss!\n\nVi trener i idrettshallen på SIT Gløshaugen hver fredag kl 12:30-14 (og annenhver mandag/onsdag). Kom på prøvetrening da vel!\n\n___\n\nHvis du lurer på noe, send Amalie Sofie Hole Fredriksen en melding på messenger ;)\n\n[FB gruppe](https://www.facebook.com/share/g/2C5B2bJ7WivZioKW/?mibextid=K35XfP)",
            contact_email: "handball@tihlde.org",
            type: "INTERESTGROUP",
            fine_info:
                '**1 bot = 22 kr**\n\n**Dommer**: Botsjef  \n**Med-dommer**: Leder/ nestleder\n\nOversikt over antall bøter: Se "bøter".\n\n\nRettssamfunnets prinsipp:\n- Enhver er skyldig til det motsatte er bevist.\n- Alle vurderinger skal baseres på skjønn.\n- Alle TIHLDE håndball medlemmer har fullmakt til å dele ut bøter. Er en bot først meldt, kan den ikke trekkes tilbake på noen annen arena enn rettssak.\n- Det er påkrevd at man legger ved en forklaring/ årsak til lovbrudd. Så langt det er mulig skal det legges ved bildebevis på lovbrudd.\n___\n\n**BOTFEST**\n- Botsjef vil komme med en forslagsliste før botfesten, slik at vi sikrer et variert utvalg alkohol. Man står fritt frem til å bytte med hverandre, og kan ta kontakt med botsjef dersom man ønsker å ta med noe som ikke står på listen. Det viktigste er at alle har med alkohol til en verdi som tilsvarer antall bøter.\n- Botfest arrangeres innad i TIHLDE Håndball mot slutten av semesteret eller ved senere anledning som passer. Her skal straffen innkasseres, og medlemmene plikter å ta med antall enheter som egne bøter tilsvarer.\n- Om et medlem melder ikke oppmøte til botfest, blir medlemmets bøter overført til neste botfest.\n\n**RETTSSAK**\n- Aktor er personen som har meldt den aktuelle boten.\n- Dommer leser opp anmeldelsene. Her har medlemmene mulighet til å gå til rettssak dersom man er uenig i bot tildelingen. Dommere avgjør dommen etter å ha hørt aktor og forsvarer fullføre deres prosedyre.\n- Ved tap av rettssak vil tiltalte ilegges 1 bot i saksomkostninger.\n- Enhver har mulighet for å forsvare seg i en rettssak. Rettssaken starter med en gang tiltalte sier noe annet enn "godtatt", eller "klink" etter at høyesterett har lest opp anmeldelsen.\n- Høyesterett avgjør dommen etter å ha hørt med aktor og forsvarer har presentert sin sak.\n- Om et medlem melder ikke oppmøte til rettssak, blir medlemmets bøter avgjort av botsjef dersom det er lagt inn et forsvar fra tiltalte. Hvis det ikke er lagt til et forsvar, vil boten bli godkjent.\n\n**ENDRINGER**\n- Endringer i lovverket skal kunne foretas under ethvert sosialt arrangement. For at en endring skal anses som gyldig, kreves det at et representativt utvalg av de aktive medlemmene er til stede ved arrangementet, og et flertall av de tilstedeværende medlemmene må tilslutte seg forslaget. Ved betydelig uenighet eller langvarige diskusjoner, har lederen og botsjefen rett til å overstyre ved å benytte en vetorett. Denne retten kan også anvendes hvis forslaget strider mot gruppens prinsipper. Bruk av vetorett skal være siste utvei for å opprettholde effektivitet og integritet i gruppen.',
            fines_activated: 1,
            fines_admin_id: "sandbra",
        },
        {
            created_at: "2021-04-27 06:26:01.739510",
            updated_at: "2025-04-10 09:10:40.731386",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/4b36e2c5-d5f2-4018-ab52-03d91839113aHS.png",
            image_alt: null,
            name: "Hovedstyret",
            slug: "hs",
            description:
                "Hovedstyret består av Arbeidsutvalget og lederne for undergruppene. Hovedstyret er ansvarlig for driften av linjeforeningen og har ansvaret for å følge opp vedtak fra generalforsamlingen.\n\n# HS-møter\nHovedstyret har jevnlige møter der styret diskuterer og tar opp relevante saker for å forbedre linjeforeningen. Komitéledere og andre relevante medlemmer inviteres også til møtene, slik at styret holdes oppdatert på både stort og smått. Referater fra HS-møter gir TIHLDE medlemmer innsikt i hvilke saker som tas opp og er offentlige for alle medlemmer.\n\n[Referater av HS-møter](https://drive.google.com/drive/folders/1dmZ1uL6EfTA4WSOYH0Bw_2rrAwfgp_Xj?usp=sharing)\n\nØnsker du at hovedstyret skal ta opp saker? Da kan du sende en mail til hs@tihlde.org.  \n**HS-møter holdes hver tirsdag kl 16:15. Ønsker du at saken skal bli tatt opp til kommende HS-møte må du sende inn saken senest 24t før, til hs@tihlde.org**\n\n---\n\n# Arbeidsutvalget\nArbeidsutvalget (AU) består av president, visepresident og finansminister i linjeforeningen. Arbeidsutvalget velges på generalforsamlingen på vårsemesteret og sitter i ett år om gangen. \n\n- **President**: Presidenten av linjeforeningen representerer TIHLDE utad og er den som snakker på vegne av linjeforeningen.  \n- **Visepresident**: Visepresidenten gjør mye administrativt arbeid, er leders høyre hånd og bistår undergrupper og komitéer der det trengs.  \n- **Finansminister**: Finansministeren styrer økonomien og veileder undergruppene om bruk av midlene de får.\n\nArbeidsutvalget har sammen ansvaret for strategi og utvikling av linjeforeningen.\n\n**Arbeidsutvalget:**\n- **President**: Daniel Evensen  \n  Epost: president@tihlde.org  \n- **Visepresident**: Sara Alvestad Kjerstad  \n  Epost: visepresident@tihlde.org  \n- **Finansminister**: Anette Sørnes  \n  Epost: finansminister@tihlde.org  \n\n---\n\n# Undergruppeledere\nHS består også av lederne for undergruppene og tillater sterk representasjon og samarbeid mellom TIHLDEs mest sentrale grupper.\n\n**Undergruppeledere:**\n- **Teknologiminister** (Index): Embret Roås  \n  Epost: teknologiminister@tihlde.org  \n- **Promoteringsminister** (Promo): Thomas Breili Konglevoll  \n  Epost: promominister@tihlde.org \n- **Sosialminister** (Sosialen): Nathalie Graidy Andreassen  \n  Epost: sosialminister@tihlde.org  \n- **Kontorminister** (Kiosk og Kontor): Torkil Thomassen  \n  Epost: kontorminister@tihlde.org  \n- **Næringslivsminister** (Næringsliv og Kurs): Ingrid Marie Nikolaisen  \n  Epost: naeringslivsminister@tihlde.org",
            contact_email: "hs@tihlde.org",
            type: "BOARD",
            fine_info:
                "Bøter for dere jævler/søtnoser\n* En bot = 25kr\n* Botsjef har ansvar for å fiske\n* Botsjef har ansvar for å fikse innkjøpsliste\n* Botsjef er dommer under rettsaken, hen er eneveldig med unntak av bøtene hen er involvert i selv\n* I saker der botsjefen er inhabil skal noen andre være dommer på den saken, dette velges løpenende\n* Tap av rettssak: tiltalte ilegges 1 bot i boten (saksomkostninger)",
            fines_activated: 1,
            fines_admin_id: "torkit",
        },
        {
            created_at: "2024-10-31 14:58:43.796356",
            updated_at: "2025-06-01 09:25:52.779703",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/e57641a5-7188-48f2-a4a2-220aa3d8898e1-kopi.jpg",
            image_alt: null,
            name: "IdKom",
            slug: "idkom",
            description:
                "IdKom er en komité laget for å drifte og støtte TIHLDE's nåværende og potensielt fremtidig idrettslag. Gruppen består av representanter fra alle de ulike idrettslagene, og er stedet disse møtes for å samkjøre og utvikle driften av idrettslagene videre. IdKom står også for ulike supporterarrangement for lagene. Dette betyr at vi gjennom semesteret prøver å få flest mulig supportere på kamper og skape entusiasme for alle TIHLDE's idrettslag.",
            contact_email: "idkom@tihlde.org",
            type: "COMMITTEE",
            fine_info:
                "Botsystem for IdKom\n&nbsp;  \n&nbsp;   \nPrislegging av bøter\n&nbsp;  \nPris per bot skal generelt settes på rettsak mellom 20-25kroner\n&nbsp;  \n&nbsp;  \nRettsakens gang\n&nbsp;  \n1. Bot tas opp med å si annet enn “klink” eller liknende\n2. Tiltalte får så si hva de ønsker å gjøre med boten (slette/redusere) samt hvorfor \n3. Aktor får så sin taletid, argumenterer mot\n4. Spørsmål, oppklaringer, frem og tilbake\n5. Dommerne tar en avgjørelse\n6. 1 saksomkostning til tapende part, noen som helst endring i bot som reduksjon, fjerning etc. regnes som seier hos anklagede.",
            fines_activated: 1,
            fines_admin_id: "aleksalm",
        },
        {
            created_at: "2020-11-17 13:48:50.630714",
            updated_at: "2024-11-18 16:14:45.216928",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/2a6d6ee8-c928-483b-9c05-000ee6bdbe08Index.png",
            image_alt: null,
            name: "Index",
            slug: "index",
            description:
                "Index jobber smidig med utviklingen av linjeforeningens løsninger, blant annet nettsiden du er inne på akkurat nå.",
            contact_email: "teknologiminister@tihlde.org",
            type: "SUBGROUP",
            fine_info: "Skyldig til motsatt bevist.\n\nForeldring på 1 uke",
            fines_activated: 1,
            fines_admin_id: "iverli",
        },
        {
            created_at: "2022-03-10 16:55:38.063367",
            updated_at: "2022-03-10 16:55:38.063414",
            image: null,
            image_alt: null,
            name: "Informasjonsbehandling",
            slug: "informasjonsbehandling",
            description: null,
            contact_email: null,
            type: "STUDY",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2020-11-17 13:51:55.198466",
            updated_at: "2025-02-19 13:01:59.899477",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/109e8adb-d8cd-436c-a7b1-1c9d48eafdd99.png",
            image_alt: null,
            name: "JenteKom",
            slug: "jentekom",
            description:
                "JenteKom er en komité som arbeider for å skape et bedre miljø blant jentene på tvers av studieretningene. Vi jobber med å øke trivsel, motivasjon og samhold ved å tilby ulike arrangement hvor jentene i TIHLDE får mulighet til å bli bedre kjent med hverandre. Bli gjerne med i Facebook-gruppa «Jenter i TIHLDE» for å holde deg oppdatert om fremtidige arrangement.",
            contact_email: "jentekom@tihlde.org",
            type: "COMMITTEE",
            fine_info: "..",
            fines_activated: 1,
            fines_admin_id: "elisesos",
        },
        {
            created_at: "2022-04-01 12:43:06.196280",
            updated_at: "2024-11-05 16:11:18.551751",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/7151e5ee-4148-469a-a0d0-2e3e1ca0b8f4Beta%20logo%20%281%29.png",
            image_alt: null,
            name: "JubKom",
            slug: "jubkom",
            description: "",
            contact_email: "hs@tihlde.org",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 1,
            fines_admin_id: "oskarny",
        },
        {
            created_at: "2022-04-25 07:22:05.159931",
            updated_at: "2025-08-29 08:30:43.137803",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/d7b66fd7-094a-41ae-acfb-29bd6000b550klatring%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Klatring",
            slug: "klatring",
            description:
                "Interesegruppe for alle som lika å beveg seg i høyden! Enten om du er rutta eller nybegynner!\n\nMeld deg inn i facebook gruppa her:\nhttps://www.facebook.com/groups/3953092678284744/",
            contact_email: "klatring@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2023-12-28 11:20:42.503511",
            updated_at: "2025-09-05 17:28:44.522411",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/5e42b802-f22b-4679-816b-c21e1a657ffcKoK.png",
            image_alt: null,
            name: "Kiosk og Kontor",
            slug: "kontkom",
            description:
                "Kiosk og Kontor (KoK) sin hovedoppgave er å gi TIHLDEs medlemmer mulighet til et avbrekk fra studiet, samt å gi dem en sentral plass å møtes. I tillegg skal Kiosk og Kontor handle, fylle opp og drifte kiosken, kontoret og lageret. KoK skal også sørge for å opprettholde et godt samhold blant TIHLDES medlemmer ved å arrangere lavterskel arrangementer på kontoret.\n\n&nbsp; \n\nSøke om å låne kontoret eller soundboks?\n[Benytt KontRes!](https://kontres.tihlde.org/)\n\n&nbsp; \n\nSavner du noe i kiosken eller på kontoret? Send inn forslag \n[her!](https://forms.gle/C4RZV166p6ZwAuk8A)\n\n&nbsp; \n\nDokumenter:\n\n\n[Hendelsesrapport](https://drive.google.com/file/d/1I97ZSsbdsAGJCC-v74-h594uGgaqFKDt/view?usp=sharing)\n \n\n[Send inn forslag til kiosken eller kontoret](https://forms.gle/C4RZV166p6ZwAuk8A)\n\nKontakt 2: kok@tihlde.org",
            contact_email: "kontorminister@tihlde.org",
            type: "SUBGROUP",
            fine_info:
                "Høyesterett: Botsjef og Leder\n\n1 bot = 25 kr\n- Oversikt over antall bøter (se nettside/drive)\n- Botsjef er ansvarlig for registrering av bøter, men alle medlemmer kan registrere.\n- Botsjefen lager en handleliste der folk får beskjed om hva og hvor mye man skal handle inn. Summen skal være antall bøter * 25kr.\n- Botfest: arrangeres innad i KoK mot slutten av semesteret eller ved senere anledning som passer. Her skal straffen innkasseres, og medlemmene plikter å ta med antall enheter som egne bøter tilsvarer. \n- Rettssak: Botsjef/leder leser opp anmeldelsene. Her har medlemmene mulighet til å gå til rettssak dersom man er uenig i bot tildelingen. Høyesterett avgjør dommen etter å ha hørt aktor og forsvarer fullføre deres prosedyre. \n- KoK / TIHLDEs lovverk overgår statens lovverk\n- Tap av rettssak: tiltalte ilegges 1 bot i saksomkostninger \n- Tap av rettssak: tiltalte ilegges 1 bot i saksomkostninger, bare den som tar opp kan få bot.\n- I starten av forsvar MÅ man spesifisere om man skal fjerne eller redusere. \n- Aktor er personen som har meldt den aktuelle boten.\n- Enhver har mulighet for å forsvare seg i en rettssak. Rettssaken starter med en gang tiltalte sier noe annet enn godtatt etter at botsjef/leder har lest opp hele detaljerte anmeldelsen. Høyesterett avgjør dommen etter å ha hørt med aktor og forsvarer presentere sine saker.\n- Kan man ikke møte til rettssak, vil eventuelt forsvar bli brukt til å forsvare bøter, med null mulighet for å diskutere mer. \n- Om et medlem melder ikke oppmøte, blir medlemmets bøter overført til neste botfest.\n- Endring av lovverk skal vedtas ved flertall av medlemmer i KoK.\n- Gyldig fraværsgrunnlag:\n- Jobb\n- Viktig forelesning\n- Bachelor/master\n- Syk (meldt ifra innen 2 timer i forkant)",
            fines_activated: 1,
            fines_admin_id: "axelaha",
        },
        {
            created_at: "2024-11-20 09:19:17.642752",
            updated_at: "2025-08-12 09:27:35.070219",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/2f5c33a3-276c-4950-9b09-f6838f40ed8fBeta%20logo%20%282%29.png",
            image_alt: null,
            name: "Native",
            slug: "native",
            description: "Vi utvikler TIHLDE sin egen app",
            contact_email: "madsnyl@gmail.com",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2020-11-17 13:49:34.902903",
            updated_at: "2025-08-28 19:15:58.394175",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/98245368-6414-4028-b774-82cde7750d06NoK.png",
            image_alt: null,
            name: "Næringsliv og Kurs",
            slug: "nok",
            description:
                "TIHLDE Næringsliv og Kurs (NoK) har som hovedoppgave å knytte studenter og potensielle arbeidsgivere tettere sammen. Dette stiller krav til profesjonalitet og kontinuitet i arbeidet. Vi arrangerer bedriftspresentasjoner, kurs og bedriftsbesøk, slik at studentene kan bli bedre kjent med næringslivet. \n\nI tillegg synliggjør vi karrieremuligheter gjennom stillingsannonser og instatakovers på vår [instagramprofil](https://www.instagram.com/tihlde_nok/). Vi holder oss også aktive på [LinkedIn](https://www.linkedin.com/company/tihlde/). For stillingsannonser, kontakt oss på stillingsannonser@tihlde.org.\n\nAndre henvendelser kan sendes til e-posten under.",
            contact_email: "naeringslivsminister@tihlde.org",
            type: "SUBGROUP",
            fine_info:
                "## Praktiske detaljer\n* En enhet = en 0,5 liter øl til minst 27,5,- stk\n* 5 øl = 4 cider\n* 13 enheter kan omgjøres til 0,7L sprit\n* Enhver tiltalt har mulighet til å forsvare seg i en rettssak. Rettssaken kjøres på møter hvor det passer. Juryen avgjør dommen etter å ha hørt aktor og forsvarer presentere sine saker. Ved tap av rettssak ilegges man 1 enhet i saksomkostninger\n* Straffen innkasseres på egne sosiale arrangementer med gruppen. \n* Straff er for fellesskapet, ikke enkeltpersonen. Enhetene deles på alle medlemmene\n* Botreglementet er i stadig utvikling, og bot-paragrafer kan legges inn kontinuerlig\n* Før man er ferdig i NoK skal man betale de siste bøtene sine på det siste arrangementet man deltar på for det gjeldende semesteret (eksempelvis botfest, sommeravslutning eller julebord). Man må betale selv om man ikke har mulighet til å delta.\n* Roller under rettsaken: Aktor, tre (3) jurymedlemmer og én (1) vara",
            fines_activated: 1,
            fines_admin_id: "smblund",
        },
        {
            created_at: "2025-03-19 10:52:05.469363",
            updated_at: "2025-04-02 11:12:38.551997",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/1cdbc219-867d-4a7e-88e9-b6d75151ead1%C3%B8kom.png",
            image_alt: null,
            name: "Økom",
            slug: "okom",
            description: "",
            contact_email: "finansminister@tihlde.org",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2022-03-31 21:53:56.950492",
            updated_at: "2025-04-28 09:40:54.944541",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/9bfedc4e-776c-49f6-915b-531a3822cac8plask%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Plask",
            slug: "plask",
            description:
                "TIHLDES stolte plaskere! En gjeng som driver med alt fra dødsing til flyting til badstue. Bading skjer som regel på søndager, og vi er alltid åpne for flere plaskeglade studenter! Send oss en DM på Instagram ved interesse @tihlde_plask og bli med i \n[facebook](https://www.facebook.com/share/g/19NexxGn27/?mibextid=wwXIfr)\n\n_Plaskemestere: Victor Hessevaagbakke, Hanna Steinhagen og Stian Walmann_",
            contact_email: "plask@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2024-11-12 18:37:58.165336",
            updated_at: "2025-09-03 14:03:36.449781",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/e5588104-a14c-4c0b-be73-182dc2fb5d6dTIHLDE_poker-2.png",
            image_alt: null,
            name: "TIHLDE Poker",
            slug: "poker",
            description:
                "TIHLDE Poker er en gruppe for alle i TIHLDE som er interessert i å spille poker, uansett nivå.\n\n&nbsp;  \n\nBli med i gruppen ved å melde inn interesse [her](https://tihlde.org/sporreskjema/2842bfe8-90a6-4803-a4a4-210b5c8839a6/)!\n\n&nbsp;  \n\nGruppen har en [spond-gruppe](https://group.spond.com/GCXOU) som brukes til å organisere intern aktivitet.",
            contact_email: "sigursc@stud.ntnu.no",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2020-11-17 13:49:43.696320",
            updated_at: "2024-08-11 21:53:58.864078",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/0fffd891-eeb2-4763-aa9d-10a22332a961Promo.png",
            image_alt: null,
            name: "Promo",
            slug: "promo",
            description:
                "Promo er undergruppen som står for å informere medlemmer om TIHLDES saker og arrangementer!\nMed andre ord, det er vi som lager og designer plakater, innlegg på Instagram/Facebook, tar bilder på arrangementer og all annen blest for TIHLDE.\n\nOppdrag til Promo?: https://tihlde.org/nyheter/236/viktig-info-om-overgang-til-notion/",
            contact_email: "promoteringsminister@tihlde.org",
            type: "SUBGROUP",
            fine_info:
                "# Botsystem for promo\n\n## Botfest og rettssak\n\nBotsjef er ansvarlig for å arrangere og gjennomføre både rettssak og botfest. Botfest kan senest finne sted 2 uker før eksamensperioden, og rettssak skal være senest 1 uke før botfest. Botfest må gjennomføres på én dag. Hvis botsjef ikke kan møte til rettsak må det delegers en vikar-botsjef for rettsaken\n\nPå hver rettssak blir alle tapte- og ikke-forsvarte bøter godkjent\nBotsjef eller promoteringsminister MÅ være tilstede på rettssak for at den skal kunne iverksettes. Medlemmer som ikke stiller på rettssak (uten gyldig grunn), blir straffet med bot, og vil få alle gjeldende bøter godkjent. Om et medlem ikke stiller på botfest (uten gyldig grunn), blir dette straffet med bot, og alle godkjente bøter blir overført til neste botfest.\n\nEtter rettssakens start(hammerslag i bordet) vil ingen nye bøter bli behandlet i gjeldene rettssak, og må utsettes til neste rettssak. \n\n\n## Lover og regler\nEndring i lovverket må gjøres i et promo felleskap hvor over 50% av medlemmer er tilstede.\n\nEtter meldt bot, er det IKKE lov å redigere, slette eller godkjenne boten, før rettssak, og dette er bare rettigheter promoteringsminister og botsjef har.",
            fines_activated: 1,
            fines_admin_id: "eskilrs",
        },
        {
            created_at: "2021-11-22 14:09:54.218192",
            updated_at: "2025-08-30 14:26:52.400294",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/281276d0-1003-460e-b2c0-adea9d1a87b4487833712_683784937367513_3823614695904354968_n.jpg",
            image_alt: null,
            name: "Pythons Fotball Herrer",
            slug: "pythons-gutter-a",
            description:
                "Herrelaget til TIHLDE som triller fotball på Tempe kunstgress i helgene. \n\nFølg oss!\n\nFacebook: https://www.facebook.com/groups/733042272801462/\n\nInstagram: instagram.com/tihlde_pythons/",
            contact_email: "pythons@tihlde.org",
            type: "INTERESTGROUP",
            fine_info:
                "Botreglementet er TIHLDE Pythons øverste totalitære lovverk. Det er utarbeidet av TIHLDE Pythons førstelag, som består av spillere, trenerapparat og botsjef. Botreglementet er ment for å sikre at spillerene følger TIHLDE Pythons normer. Brudd på reglementet medfører straff i form av bøter. Alle tiltalte har rett til å forsvare seg i en rettsak.\n\n> Straff er for fellesskapet, ikke enkeltpersonen. Bøter er for botfest.\n\n___\n\n- **Botsjef og aktor** er ansvarlig for riktig registrering av bøter og gjennomføring av rettsaker. Bestemmes ved avstemning en gang i året.\n- **Dommere** er upartiske representanter fra laget som avgjør dommen til den tiltalte ved rettsak. Bestemmes ved avstemning en gang i året.\n- **VAR** er varadommer. Den stedfortredende dommeren vil tre inn som hoveddommer dersom en av dommerene ikke kan møte til rettsak eller av en grunn er innhabil.\n- **POTB** er spilleren på laget som sist ble tildelt vandrepokalen *Player of the Botfest*. POTB er ansett som lagets beste spiller, ref. § 12.\n\n___\n\n- Anmeldelser blir fremmet på [gruppens side på tihlde.org](https://tihlde.org/grupper/pythons-gutter-a/boter/)\n- En enhet øl - kun 0,33L Dahls boks\n- Enhver tiltalt har mulighet til å forsvare seg i en rettssak. Rettssaken starter med en gang den tiltalte sier noe annet enn godtatt etter at aktor har lest opp hele detaljerte anmeldelsen. Dommerne avgjør dommen etter å ha hørt aktor og forsvarer presentere sine saker.\n- Ved tap av rettssak ilegges man 1 enhet i saksomkostninger\n- Aktor og ansvarlig for registrering av bøter er Botansvarlig.\n- Straffen innkasseres på egne botfester.\n- Botreglementet kan kun revideres ved botfest. Det skal stemmes over om en revidering skal gjennomføres på den aktuelle botfesten.\n- Dersom man av spesielle årsaker ikke ønsker å bidra med bøter i form av øl, kan noe av tilsvarende økonomisk og stemningsfremmende verdi medbringes.",
            fines_activated: 1,
            fines_admin_id: "zakariyi",
        },
        {
            created_at: "2021-11-22 14:13:58.669366",
            updated_at: "2025-08-25 15:56:45.930560",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/854fea60-cbd1-402b-866d-e8e98c64aaa28ff50f39774dc43bde26244005323f59.jpeg",
            image_alt: null,
            name: "Pythons Fotball Damer",
            slug: "pythons-jenter",
            description:
                "# TIHLDEs fotballag for damer\n\nEnten du har spilt fotball i årevis eller bare liker å sparke litt ball på fritiden, er du hjertelig velkommen hos oss! Vi er et lavterskel 7-er lag som spiller i 7dentligaen, hvor vi fokuserer på spilleglede, samhold og gode opplevelser på banen som et lag. \n\nIngen krav til forkunnskaper – bare en lyst til å ha det gøy med fotball! Kom og bli en del av laget! \n&nbsp;  \n&nbsp;  \nTa kontakt med Ingrid Gjerdrum på messenger. Så er du med på laget!\n\n&nbsp;  \n&nbsp;  \nFølg med på oss instagram her: \n[TIHLDE Pythons damer](https://www.instagram.com/tihldepythonsdamer/)",
            contact_email: "pythonsdamer@tihlde.org",
            type: "INTERESTGROUP",
            fine_info:
                "# Rettsprinsipp\nDommer: Botsjef\n&nbsp;  \nMeddommer: Leder/ nestleder\n\n**Guilty until proven innocent** \n\nEnhver er skyldig inntil uskyldighet er bevist\n\n\n**Dokumentasjon**\n\nDet er påkrevd at man legger ved en forklaring/ årsak til lovbrudd \n\nSå langt det er mulig skal det legges ved bildebevis på lovbrudd",
            fines_activated: 1,
            fines_admin_id: "elisfh",
        },
        {
            created_at: "2020-11-17 13:52:08.483713",
            updated_at: "2025-04-24 12:53:45.515031",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/62d0b6f0-8eac-4a9a-ab87-66ba11dfe241TODDEL%20logo.png",
            image_alt: null,
            name: "Redaksjonen",
            slug: "redaksjonen",
            description:
                "Redaksjonen er gjengen som produserer linjeforeningsbladet til TIHLDE.",
            contact_email: "redaktor@tihlde.org",
            type: "COMMITTEE",
            fine_info: "",
            fines_activated: 1,
            fines_admin_id: "sindrelm",
        },
        {
            created_at: "2025-02-20 08:02:39.672524",
            updated_at: "2025-09-10 08:46:34.492930",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/6f22e561-bbb0-4935-82fe-24293e68c780rett%26vrang%20logo.jpg",
            image_alt: null,
            name: "TIHLDE Rett&Vrang",
            slug: "rettogvrang",
            description:
                "Vi mener et par pinner og et garnøste tar seg godt ut i enhver anledning, og TIHLDE rett&vrang er\ngruppen som skal bevise dette. Gruppen er for alle som liker å strikke, hater å strikke, vil lære å\nstrikke eller som vil være med bare for å ha det gøy!\n\nBli med i [TIHLDE rett&vrang](https://www.facebook.com/groups/2071000050055925/) på Facebook for å bli lagt inn som medlem, eller (aller helst) [trykk her](https://tihlde.org/sporreskjema/22ee1a32-d481-4e79-ad49-fefaa3609296/) <3",
            contact_email: "rettogvrang@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2021-05-03 12:04:44.531510",
            updated_at: "2025-01-09 10:25:02.873252",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/0907ea7a-b39a-4ee9-87f8-8a7e9cfeeb92Beta%20logo%20%281%29.png",
            image_alt: null,
            name: "Semikolon",
            slug: "semikolon",
            description:
                "Semikolon er TIHLDEs linjeforeningsband som sørger for å lage stemning på arrangementer eller at noen datafolk dummer seg ut på scenen. Noen ganger kanskje begge samtidig.",
            contact_email: "semikolon@tihlde.org",
            type: "COMMITTEE",
            fine_info:
                "Enhver er skyldig til det motsatte er bevist.\r\n\r\nAlle vurderinger skal baserer på skjønn.\r\n\r\nAlle medlemmer av Semikolon har lik rett til å dele ut bøter.",
            fines_activated: 1,
            fines_admin_id: "torabir",
        },
        {
            created_at: "2025-09-11 20:16:51.807981",
            updated_at: "2025-09-11 20:16:51.808002",
            image: null,
            image_alt: null,
            name: "TIHLDE Smash",
            slug: "smash",
            description: null,
            contact_email: null,
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2020-11-17 13:49:14.777248",
            updated_at: "2024-11-02 16:37:27.231482",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/fc468372-3fe9-4ff6-8190-d7592dfe8e24Sosialen.png",
            image_alt: null,
            name: "Sosialen",
            slug: "sosialen",
            description:
                "Sosialen sørger for samhold på tvers av alle linjene i TIHLDE! De arrangerer alt fra LAN til fester og hytteturer.",
            contact_email: "sosialminister@tihlde.org",
            type: "SUBGROUP",
            fine_info: "",
            fines_activated: 1,
            fines_admin_id: "magnubox",
        },
        {
            created_at: "2024-03-21 15:58:31.742883",
            updated_at: "2025-09-15 09:56:17.465088",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/eab5051c-cbd4-463f-bdb3-a0c763feb0edspring.png",
            image_alt: null,
            name: "TIHLDE Spring",
            slug: "spring",
            description:
                "Er du personen som spurter for livet langs kongens gate for å rekke 3er bussen? Eller liker du bare å løpe? Eller liker du ikke å løpe men trenger litt mer motivasjon for å komme deg ut på trening?\n\nBli med i TIHLDE Spring!\n\nSpring er TIHLDEs løpegruppe, hvor ukentlige treninger, og stafetter står for tur. Dette vil du ikke gå glipp av!\n\nVi satser på å få til en tur til Oslo neste år for Holmenkollstafetten 2026!\n\nMeld deg inn i gruppen [her](https://tihlde.org/sporreskjema/57812203-d145-472c-86e0-8f4bcf243d7e/)\nOg bli med i facebookgruppen: https://www.facebook.com/groups/1444687716138182/",
            contact_email: "fredrik.borbe@gmail.com",
            type: "INTERESTGROUP",
            fine_info: "Kjør",
            fines_activated: 0,
            fines_admin_id: "fredritb",
        },
        {
            created_at: "2022-10-23 12:09:45.102207",
            updated_at: "2025-03-12 11:46:06.691934",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/f92b5a02-9485-4e7f-9249-9f5ea1c639bfpodden%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDEpodden",
            slug: "thilde-podden",
            description:
                "TIHLDEpodden har som hensikt å tilby underholdning til medlemmene. Her kommer det info om episodene så bare å følge med!\nDersom du ønsker å være gjest i studio eller har noen innspill kan du sende oss en mail på: podcast@tihlde.org\n\nLink til episoder finner du her: https://linktr.ee/tihldepodden",
            contact_email: "podcast@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "Under utvikling",
            fines_activated: 1,
            fines_admin_id: "sebastsn",
        },
        {
            created_at: "2021-04-26 17:23:45.542335",
            updated_at: "2021-04-26 17:23:45.542386",
            image: null,
            image_alt: null,
            name: "TIHLDE",
            slug: "tihlde",
            description: "TIHLDE Linjeforening",
            contact_email: null,
            type: "TIHLDE",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2023-01-26 15:00:11.508763",
            updated_at: "2025-04-02 11:10:32.385716",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/93364fe0-b321-48df-bc8c-2656b13adaf5klask%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Klask",
            slug: "tihlde_klask",
            description:
                "Interessegruppen med mest faglig tyngde. Det klaskes på alle underlag, og helst med svindyrt utstyr.\n\nVed spørsmål, ta kontakt med meg Kevin Elson på messenger eller kevinse@ntnu.no",
            contact_email: "kevinse@ntnu.no",
            type: "INTERESTGROUP",
            fine_info:
                "Bot for dårlig oppførsel. Dårlig oppførsel inkluderer blant annet:\n- Tap\n- Ingen banning gjennom en hel økt\n- Ingen banning ved tap\n- Sinnemestring\n- Låneutstyr",
            fines_activated: 0,
            fines_admin_id: "mross",
        },
        {
            created_at: "2022-10-23 19:15:41.781171",
            updated_at: "2025-04-02 11:09:41.612192",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/c7748fff-a2a4-4ef2-b58d-c724217b6de5Fotball%20og%20f1%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Fotball og F1",
            slug: "tihlde-ff",
            description:
                "Interessegruppe for fotball og formel 1.\nFølg oss på insta og bli med i facebook gruppen for å bli med å avgjøre kampene vi viser, og holde deg oppdatert!\nInsta:\nhttps://www.instagram.com/tihlde_ff\nFacbookgruppe: https://www.facebook.com/groups/638948531024563/",
            contact_email: "tihldeff@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 1,
            fines_admin_id: "pettaasl",
        },
        {
            created_at: "2023-07-26 08:26:53.561215",
            updated_at: "2025-08-15 13:22:14.318977",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/ac2d4368-de6a-463c-b7f6-96c4e6b2ab82golf%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Golf",
            slug: "tihlde-golf",
            description:
                'Dette er interessegruppen for oss som deler interessen for konkurransenes pinnacle, golf. \nFølg oss på Instagram: @tihldegolf\n\nSpørsmål kan sendes til golf@tihlde.org eller DM på Instagram. \n\nAlle golfere er velkomne i denne gruppen!\n\n**Bli med her✅**\n[Facebook](https://www.facebook.com/share/g/19qBAnjUeR/?mibextid=wwXIfr)\n\n“I kind of got into golf mainly because from a competitive standpoint to me, it is the hardest game to play. I can always respond to an opponent, defensive guy, offensive guy whatever but in golf, it’s like playing in a mirror. You’re battling yourself consistently to try to get perfection. Every swing. Every putt." M.J.',
            contact_email: "golf@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: "petterju",
        },
        {
            created_at: "2025-05-07 11:17:59.268429",
            updated_at: "2025-08-31 19:40:54.555992",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/95a4d115-c775-4b01-944b-8a609973cca0v3.png",
            image_alt: null,
            name: "TIHLDE Startup",
            slug: "tihlde-startup",
            description: "We start shit up",
            contact_email: "kasper.sando@gmail.com",
            type: "INTERESTGROUP",
            fine_info:
                "Ekstraordinær hendelse\nBøtlegges med alt fra 1 til 1 million bøter",
            fines_activated: 1,
            fines_admin_id: "kasperjs",
        },
        {
            created_at: "2022-09-23 08:03:29.599269",
            updated_at: "2025-03-12 11:45:45.800808",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/79533adb-5044-489c-b455-f0410cb72aa2bh%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE BH",
            slug: "tihldebh",
            description:
                "TIHLDE Brygg og Hygg er en sosial gruppe for bryggeentusiaster og nysgjerrige som ønsker å lære mer om kunsten å brygge. Vi arrangerer jevnlig bryggeøkter der medlemmene kan delta, dele kunnskap og ha det hyggelig sammen. Dette er en unik mulighet til å kombinere læring, tradisjon og godt selskap i et inkluderende og uformelt miljø. Enten du er erfaren eller helt nybegynner, er du hjertelig velkommen til å bli en del av TIHLDE Brygg og Hygg!",
            contact_email: "tihldebh@tihlde.org",
            type: "INTERESTGROUP",
            fine_info:
                "alt kan være en bot, vær kreativ, botfest en gang i semesteren\n\nBotsjef: Erik Hoff",
            fines_activated: 1,
            fines_admin_id: "eahoff",
        },
        {
            created_at: "2022-03-09 19:51:49.910985",
            updated_at: "2025-05-08 10:52:16.798925",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/f7c4d24b-8f0e-44e5-88a6-1427275fe0d3ski%20%28-%29.png",
            image_alt: null,
            name: "TIHLDE Ski",
            slug: "tihldeski",
            description:
                "TIHLDE Ski er en gruppe for alle i TIHLDE med interesse for PowPow og god glid<3\n\nI løpet av året arrangerer vi korte og lengre turer, treningsøkter, sosiale sammenkomster og fester m.m. hvor målet er trivsel for alle som vet å kose seg i snøen. Her er ingen verken for gode eller dårlige på ski (eller brett) til å bli med! Du er velkommen til å chille, jibbe, pilse og tryne akkurat som du vil!\n\nVi driver med mer aktivitet enn noen gang er, og er supergira for neste sesongs Åre-tur, (X2-festival?), og masse god kjøring. Snakkes i bakken (og på afterski)! :)\n\nPils og hils fra TIHLDE-Skis ledere\nHedda, Fredrik og Tiril<3\n\nIG: @tihldeski\nFB gruppe: TIHLDEski",
            contact_email: "tihldeski@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2023-10-11 12:42:41.764942",
            updated_at: "2025-05-07 07:46:03.838117",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/d44e95ef-1893-48fb-96f7-61a30b05cc6dutveksling%20%28godkjent%29.png",
            image_alt: null,
            name: "TIHLDE Utveksling",
            slug: "tihldeutveksling",
            description:
                'Hei fremtidige utvekslingselev! \n&nbsp;  \n\nOm du skal, vil, vurderer eller har mulighet til å dra på utveksling er det fint med et fellesskap som, som Pitbull sier, har "been there done that"\uD83E\uDD19\uD83C\uDFFD \n&nbsp;  \n\nBli med i [Facebook-gruppen](https://www.facebook.com/groups/1584316695601124/) for informasjon og arrangementer fremover, og sjekk ut\nInstagram @tihldeutveksling for inspirasjon fra tidligere utvekslingsopphold!\n&nbsp;  \n&nbsp;  \n\nLedere: Sigri Råen og Ellen Urdal<3',
            contact_email: "utveksling@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2021-04-27 14:12:45.708753",
            updated_at: "2025-03-12 11:44:47.176983",
            image: "https://leptonstoragepro.blob.core.windows.net/imagepng/d1e7e9db-6088-4151-8cee-ea77afdd915cturtorial%20%28godkjent%29.png",
            image_alt: null,
            name: "Turtorial",
            slug: "turtorial",
            description:
                "Turtorial sitt mål er å tvinge datafolk til å ta på gress. Om du trives ute i norsk natur, og ønsker å utforske Trondheims natur sammen med likesinnede studenter, så burde du definitivt bli med på tur. Følg med på tihlde.org, vår Facebookside, og vår kalender, så du ikke går glipp av turene!\n\nhttps://www.facebook.com/groups/1118123475862139?locale=nb_NO",
            contact_email: "turtorial@tihlde.org",
            type: "INTERESTGROUP",
            fine_info: "",
            fines_activated: 0,
            fines_admin_id: null,
        },
        {
            created_at: "2021-11-22 14:14:26.395864",
            updated_at: "2025-09-10 19:33:33.417716",
            image: "https://leptonstoragepro.blob.core.windows.net/imagejpeg/aff3863a-4aaf-4937-ba41-3f0e5010bdfepythons_logo.jpg",
            image_alt: null,
            name: "Pythons Volley",
            slug: "volley",
            description:
                "Pythons Volley er et lavterskeltilbud for alle TIHLDE medlemer, uansett om du er proff på smash eller aldri har tatt i en ball før.  \n\n\uD83D\uDCC5 **Treningstider:**  \nLegges ut fortløpende på [Spond](https://spond.com/invite/VQDUN) – meld deg inn for å holde deg oppdatert!  \n\n\uD83D\uDCF8 **Følg oss på Instagram:**  [@pythons_volley](https://instagram.com/pythons_volley)",
            contact_email: "oliverroddesnes@tihlde.org",
            type: "INTERESTGROUP",
            fine_info:
                '# Judge, Jury, Double Executioner  \n**Oliver og Ola / Leder og Botsjef**\n\n## \uD83D\uDCB0 Bøter\n- Oversikt over antall bøter: *Se bøter*\n- 1 bot = 20-25 kr\n- Botsjef er ansvarlig for registrering av bøter, men det oppfordres til at alle medlemmer registrerer bøter om noe botverdig skjer.\n- Tiltalte er den som har utført den botverdige handlingen.\n- Aktor er personen som har meldt den aktuelle boten.\n\n## ⚖\uFE0F Rettssak\n- Dommer leser opp anmeldelsene.\n- Medlemmer kan gå til rettssak dersom man er uenig i bot-tildelingen.\n- Dommere avgjør dommen etter å ha hørt aktor og forsvarer fullføre deres prosedyre.\n- Tap av rettssak: Tiltalte ilegges 1 bot i saksomkostninger.\n- Enhver har mulighet for å forsvare seg i en rettssak.\n- Rettssaken starter med en gang tiltalte sier noe annet enn "godtatt", "klink" e.l. etter at høyesterett har lest opp hele anmeldelsen.\n- Høyesterett avgjør dommen etter å ha hørt aktor og forsvarer presentere sine saker.\n\n## \uD83E\uDD20 Botfest\n- Botsjef vil komme med en forslagsliste før botfesten, slik at vi sikrer et variert utvalg alkohol.\n- Man står fritt frem til å bytte med hverandre, og kan ta kontakt med botsjef dersom man ønsker å ta med noe som ikke står på listen.\n- Det viktigste er at alle har med alkohol til en verdi som tilsvarer antall bøter.\n- Botfest arrangeres innad i Pythons Volley mot slutten av semesteret eller ved senere anledning som passer.\n- Her skal straffen innkasseres, og medlemmene plikter å ta med antall enheter som egne bøter tilsvarer.\n\n## \uD83D\uDEAB Fravær og overføring\n- Om et medlem melder ikke oppmøte, blir medlemmets bøter overført til neste botfest.\n- Bøter meldt under rettssakens start, som ikke er en direkte effekt av rettssaken i seg selv, gjelder fra neste botfest.\n\n## \uD83D\uDEE0 Endringer i lovverket\n- Endringer i lovverket skal kunne foretas under ethvert sosialt arrangement.\n- For at en endring skal anses som gyldig:\n  - Et representativt utvalg av de aktive medlemmene må være til stede.\n  - Et flertall av de tilstedeværende medlemmene må tilslutte seg forslaget.\n- Ved betydelig uenighet eller langvarige diskusjoner:\n  - Leder og botsjef har rett til å overstyre ved å benytte vetorett.\n  - Vetorett kan også anvendes hvis forslaget strider mot gruppens prinsipper.\n  - Bruk av vetorett skal være et siste middel for å opprettholde effektivitet og integritet i gruppen.',
            fines_activated: 1,
            fines_admin_id: "olasy",
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

    console.log("🌱 Successfully seeded the database");
};
