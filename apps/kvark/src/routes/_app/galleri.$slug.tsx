import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";

export const Route = createFileRoute("/_app/galleri/$slug")({
    component: GalleryDetailPage,
});

const TITLE = "Vårgalla 2026";
const DESCRIPTION = "Her er bildene fra årets vårgalla!";

const IMAGES = [
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/0197e132-7bf6-4087-bff4-a8d34ad45bfd15-DSC02484.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/17bf0d9a-9975-4b9a-9c5a-1e57d04bf27e29-IMG_0436.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/7695b729-a36c-4791-8d7b-d84cbb972413101-IMG_0581.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/fc239aa3-983a-40d2-ab9d-948b8c2aa58c77-IMG_0524.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/16327afa-78ea-4665-ba52-512ef2c79f2e92-IMG_0566.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/ce307aa7-c3d5-46b9-a8bd-b7f90f4672fe102-IMG_0582.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/60f3a69e-93cd-4d79-ab12-b32b0a40db4871-DSC02712.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/39092d98-7102-4a7f-92a6-4eac5df5431a91-IMG_0565.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/e9f4f9a8-bd3c-4e9e-8469-d89c390d22e953-DSC02555.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/c6e9c7a6-7d06-4650-9a8e-308012cb2ce669-DSC02684.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/824ac782-7b13-46a3-a1b0-784ba6ba240557-DSC02626.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/20d49535-2da8-41d9-bbb4-ad1fdc28a96660-DSC02632.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/ed0753be-19ef-492a-a90b-01e2b26a4abf28-IMG_0435.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/e0f1e407-fc66-485f-a60f-331189c03f5640-IMG_0463.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/0ef5e6b3-80bd-4f43-a9d8-01eb36acddc773-IMG_0508.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/a548bf28-ba50-4f61-8c60-97bfd6c5905c48-IMG_0479.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/d0616158-fb75-4337-9e56-fbd5ac424e6a95-IMG_0571.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/df7b9613-e5e2-4355-8d0c-226d8341fbd21-DSC02455.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/0a62bcd2-eaf3-49a2-8795-70daaa3b086e61-DSC02635.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/98a36cf9-9d13-4035-b488-6f47d42972ee98-IMG_0574.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/4f4c7101-85db-4840-85c9-ecf372fc06fd64-DSC02642.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/de5e9d9d-8c67-455b-a3b8-b7f5f1c6591d38-IMG_0459.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/aeeea358-3c77-495e-a958-24aa564b90e759-IMG_0486.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/e61f2cfd-de14-4e68-bd42-2dfad66e397e21-IMG_0415.jpg",
    "https://leptonstoragepro.blob.core.windows.net/imagejpeg/ec5cfe4d-2901-438a-b04d-ff2cc4cb5c4f47-IMG_0478.jpg",
];

function GalleryDetailPage() {
    return (
        <div className="container mx-auto flex w-full flex-col gap-10 px-4 py-8 md:py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl lg:text-5xl">{TITLE}</h1>
                <p className="text-muted-foreground">{DESCRIPTION}</p>
            </div>

            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
                {IMAGES.map((src) => (
                    <Dialog key={src}>
                        <DialogTrigger className="mb-4 block w-full break-inside-avoid overflow-hidden">
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                className="block h-auto w-full object-cover"
                            />
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] p-2 sm:max-w-3xl lg:max-w-5xl">
                            <img
                                src={src}
                                alt=""
                                className="block h-auto max-h-[85vh] w-full object-contain"
                            />
                        </DialogContent>
                    </Dialog>
                ))}
            </div>

            <div className="flex justify-center">
                <Button variant="outline">Last inn mer</Button>
            </div>
        </div>
    );
}
