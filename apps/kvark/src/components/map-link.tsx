import { Button } from "@tihlde/ui/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@tihlde/ui/ui/dropdown-menu";

import type { MapsUrls } from "#/lib/maps";

type MapLinkProps = {
    /** Adressen slik den vises for brukeren. */
    label: string;
    urls: MapsUrls;
};

/**
 * Adresse som åpner en meny med karttjenester, slik at brukeren åpner stedet
 * i den appen de faktisk bruker.
 */
export function MapLink({ label, urls }: MapLinkProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="link"
                        aria-label={`Åpne ${label} i kart`}
                        className="h-auto justify-start p-0 text-left whitespace-normal"
                    />
                }
            >
                {label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-40">
                <DropdownMenuItem
                    render={
                        <a
                            href={urls.google}
                            target="_blank"
                            rel="noreferrer"
                        />
                    }
                >
                    Google Maps
                </DropdownMenuItem>
                <DropdownMenuItem
                    render={
                        <a href={urls.apple} target="_blank" rel="noreferrer" />
                    }
                >
                    Apple Maps
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
