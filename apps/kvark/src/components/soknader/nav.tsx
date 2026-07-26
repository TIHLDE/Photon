import { FileText, Gavel, HandCoins, ListChecks, Trophy } from "lucide-react";
import type { ReactNode } from "react";

export type SoknadNavKey =
    | "utlegg"
    | "stotte"
    | "idrettslag"
    | "hs-sak"
    | "mine";

export type SoknadNavItem = {
    key: SoknadNavKey;
    label: string;
    icon: ReactNode;
};

export const SOKNAD_NAV_ITEMS: SoknadNavItem[] = [
    { key: "utlegg", label: "Utlegg", icon: <FileText /> },
    { key: "stotte", label: "Søk om støtte", icon: <HandCoins /> },
    { key: "idrettslag", label: "Støtte til idrettslag", icon: <Trophy /> },
    { key: "hs-sak", label: "Sak til HS", icon: <Gavel /> },
    { key: "mine", label: "Mine søknader", icon: <ListChecks /> },
];
