import { Button } from "@tihlde/ui/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@tihlde/ui/ui/empty";
import { TriangleAlertIcon } from "lucide-react";

type RouteErrorProps = {
    /**
     * Teknisk feilmelding. Send den bare inn i utvikling — den sier ingenting
     * til folk som bare skulle lese sida.
     */
    detail?: string;
    onRetry: () => void;
};

/**
 * Vist når en rute ikke fikk lastet dataene sine, i stedet for TanStack
 * Routers innebygde «Something went wrong!» — som er uoversatt, ustylet og
 * ikke gir noen vei videre.
 */
export function RouteError({ detail, onRetry }: RouteErrorProps) {
    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <TriangleAlertIcon />
                </EmptyMedia>
                <EmptyTitle>Vi fikk ikke lastet siden</EmptyTitle>
                <EmptyDescription>
                    Som regel går det over av seg selv. Prøv igjen.
                </EmptyDescription>
                {detail ? <EmptyDescription>{detail}</EmptyDescription> : null}
            </EmptyHeader>
            <Button onClick={onRetry}>Prøv igjen</Button>
        </Empty>
    );
}
