import { createFileRoute } from "@tanstack/react-router";

import { GalleryCard, type GalleryCardProps } from "#/components/gallery-card";

export const Route = createFileRoute("/_app/galleri/")({
    component: GalleriesPage,
});

const GALLERIES: GalleryCardProps[] = [
    {
        slug: "vaargalla-2026",
        title: "Vårgalla 2026",
        description: "Her er bildene fra årets vårgalla!",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/1368c119-2945-46e5-bd6a-84998ed78a3c5-DSC02468.jpg",
    },
    {
        slug: "tihlde-x-dnv",
        title: "TIHLDE x DNV",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/a3bd23eb-0363-405b-b2b6-a89be5d817f0IMG_0109.jpeg",
    },
    {
        slug: "julebord-2025",
        title: "Julebord 2025",
        description: "Bilder fra årets julebord!🎄",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/a5cd2ed6-b3a1-46a0-bd18-60f6cc9ab57649-DSC00464.jpg",
    },
    {
        slug: "halloween-2025",
        title: "Halloween 2025",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/62374209-2ec9-44af-a3b5-6fad11f15f7a62-IMG_9345.jpg",
    },
    {
        slug: "immeball-2025",
        title: "Immeball 2025",
        description: "Bilder fra immeballet🫶🏼",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/c52c62ec-0b88-4afb-aee8-f88a5a05db08IMG_3859_Original.jpeg",
    },
    {
        slug: "julebord-h24-del-2",
        title: "Julebord H24 del 2",
        description: "Del to av bilder fra julebordet på Rockheim<3",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/951fb3c9-7caf-4194-9639-5670d4cee64cJulebord%20sony-40.jpg",
    },
    {
        slug: "julebord-h24-del-1",
        title: "Julebord H24 del 1",
        description: "Bilder fra julebordet på Rockheim høsten 2024!",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/84ce9c07-3415-454b-a23f-3bb06aabe748Julebord%20canon-37.jpg",
    },
    {
        slug: "halloween-h24",
        title: "Halloween H24",
        description:
            "Bilder fra halloween høsten 2024! Hvorfor er det så få bilder? Det forblir et mysterium:)",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/dab3a4f9-d993-4f09-8921-2e70f9521ae1halloween-19.jpg",
    },
    {
        slug: "laavefest-ubildevegg-h24",
        title: "Låvefest (u/bildevegg) H24",
        description:
            "Bildene fra låvefest høst 2024 (se eget galleri for bildene fra bildeveggen).",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/42e7a30c-ca2e-4232-8396-3ecf3eda5fd6Oktoberfest%20-275.jpg",
    },
    {
        slug: "laavefest-bildevegg-h24",
        title: "Låvefest (bildevegg) H24",
        description:
            "Bilder fra låvefest høsten 2024 (se eget galleri for bilder uten bildevegg).",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/5bd1459d-32f4-4251-acd5-345827a3e687Oktoberfest%20-080.jpg",
    },
    {
        slug: "immatrikulering-h24",
        title: "Immatrikulering H24",
        description: "Bilder til immatrikulerings-ballet TIHLDE høsten 2024",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/9cc5be9a-773c-48ab-a21e-dc82808f6442imm.jpg",
    },
    {
        slug: "vaargalla-v24",
        title: "Vårgalla V24",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/a5c949cf-5834-40e8-a41e-2f314537fa6cDSC02260.jpg",
    },
    {
        slug: "julebord-h23",
        title: "Julebord H23",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/af446e03-6741-44bb-ae41-2d3ae892ca574195b765-9fba-4196-b976-5f60c37c32a9DSC09577.jpg",
    },
    {
        slug: "etterfest-genfors-h23",
        title: "Etterfest GenFors H23",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/b5fb68f3-1cb9-4a9f-9cac-7140bb81c05b9a03a86c-854d-4375-a6b8-42777eb9b63aDSC08453.jpg",
    },
    {
        slug: "laavefest-h23",
        title: "Låvefest H23",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/f2928b2c-f31e-4469-9cbb-61103c72fcb8lf.jpg",
    },
    {
        slug: "immatrikulering-h23",
        title: "Immatrikulering H23",
        imageUrl:
            "https://leptonstoragepro.blob.core.windows.net/imagejpeg/6262b14a-dbff-4195-a1f4-0dcfb0f824cbimme.jpg",
    },
    {
        slug: "hyttetur-v23",
        title: "Hyttetur V23",
        imageUrl:
            "https://tihldestorage.blob.core.windows.net/imagepng/5a378fc5-45c7-473c-8753-d53c9e7896ddSkjermbilde%202023-05-13%20kl.%2021.42.21.png",
    },
    {
        slug: "charitygalla-v23",
        title: "Charitygalla V23",
        imageUrl:
            "https://tihldestorage.blob.core.windows.net/imagejpeg/3d1b5a2f-9c11-484c-9d1c-65c48e46ad08CharitygallaV23-125.jpg",
    },
    {
        slug: "utmatrikulering-v22",
        title: "Utmatrikulering V22",
        description:
            "Her er alle bildene fra utmatrikulering våren 2022. Om det finnes bilder her dere ikke ønsker er det bare å fjerne.",
        imageUrl:
            "https://tihldestorage.blob.core.windows.net/imagejpeg/deb8bcc5-eedd-4e69-8945-88c9cf1347e801D16A97-EED3-4E20-B9DF-8E6D91AE90F0_1_100_o.jpeg",
    },
    {
        slug: "hyttetur-v22",
        title: "Hyttetur V22",
        imageUrl:
            "https://tihldestorage.blob.core.windows.net/imagejpeg/378f0c40-6061-4e3d-a42c-847b1654cb8fimm021_22.jpg",
    },
];

function GalleriesPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl">Galleri</h1>
                <p className="text-muted-foreground">
                    Bilder fra arrangementene våre
                </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {GALLERIES.map((g) => (
                    <li key={g.slug}>
                        <GalleryCard {...g} />
                    </li>
                ))}
            </ul>
        </div>
    );
}
