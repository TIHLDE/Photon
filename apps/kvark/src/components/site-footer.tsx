import { Separator } from "@tihlde/ui/ui/separator";
import { Facebook, Instagram } from "lucide-react";

export function SiteFooter() {
    return (
        <footer className="w-full">
            <Separator />
            <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                    <h3 className="font-heading text-sm font-semibold">
                        Kontakt
                    </h3>
                    <p>E-post: hs@tihlde.org</p>
                    <p>Lokasjon: c/o IDI, NTNU</p>
                    <p>Org.nr: 998 952 183</p>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <h3 className="font-heading text-sm font-semibold">
                        Hovedsamarbeidspartner
                    </h3>
                    <div className="flex h-12 w-40 items-center justify-center bg-muted">
                        <span className="text-xs">DNV</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="#" aria-label="Facebook">
                            <Facebook className="size-5" />
                        </a>
                        <a href="#" aria-label="Instagram">
                            <Instagram className="size-5" />
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-2 md:items-end">
                    <h3 className="font-heading text-sm font-semibold">
                        Samarbeid
                    </h3>
                    <p>NITO</p>
                </div>
            </div>
        </footer>
    );
}
