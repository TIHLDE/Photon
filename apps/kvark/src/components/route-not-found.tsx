import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { MapPinOffIcon } from "lucide-react";
import type { ReactNode } from "react";

type RouteNotFoundProps = {
    onBack: () => void;
    /**
     * Sekundærhandlingen. Sendes inn av kalleren fordi den kjenner rutene —
     * denne komponenten skal bare vise dem.
     */
    children?: ReactNode;
};

/**
 * Vist når adressen ikke finnes. Erstatter TanStack Routers innebygde
 * `<p>Not Found</p>`, som er uoversatt, ustylet og lar folk stå fast.
 */
export function RouteNotFound({ onBack, children }: RouteNotFoundProps) {
    return (
        <Empty className="min-h-[60vh] gap-6 py-24">
            <EmptyHeader className="max-w-md gap-3">
                <EmptyMedia variant="icon" className="size-12">
                    <MapPinOffIcon className="size-6" />
                </EmptyMedia>
                <EmptyTitle>Fant ikke siden</EmptyTitle>
                <EmptyDescription>
                    Lenken kan være gammel, eller adressen feilskrevet.
                </EmptyDescription>
            </EmptyHeader>
            {/* Handlingene står side om side og deler bredden likt.
             * `items-stretch` gir dem samme høyde uansett hvilken størrelse
             * kalleren gir sekundærknappen, og `flex-1` på barna sparer
             * kalleren for å måtte vite om bredden i det hele tatt. */}
            <EmptyContent className="w-full max-w-md flex-row items-stretch justify-center gap-3 [&>*]:flex-1">
                <Button size="lg" onClick={onBack}>
                    Gå tilbake
                </Button>
                {children}
            </EmptyContent>
        </Empty>
    );
}
