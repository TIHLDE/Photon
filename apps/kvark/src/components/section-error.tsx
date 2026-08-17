import { Empty, EmptyDescription, EmptyHeader } from "@tihlde/ui/ui/empty";

type SectionErrorProps = {
    /** Hva som ikke lot seg laste, sett fra leseren. */
    message: string;
};

/**
 * Vist i stedet for en enkelt seksjon som ikke fikk hentet dataene sine.
 * Motstykket til [RouteError](./route-error.tsx): den tar hele sida, denne
 * lar resten av sida stå og innrømmer bare at én bit mangler.
 */
export function SectionError({ message }: SectionErrorProps) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyDescription>{message}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
