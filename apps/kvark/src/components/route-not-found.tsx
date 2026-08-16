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
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <MapPinOffIcon />
                </EmptyMedia>
                <EmptyTitle>Fant ikke siden</EmptyTitle>
                <EmptyDescription>
                    Lenken kan være gammel, eller adressen feilskrevet.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button onClick={onBack}>Gå tilbake</Button>
                {children}
            </EmptyContent>
        </Empty>
    );
}
