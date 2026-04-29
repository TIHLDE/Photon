import {
    CalendarDays,
    ClipboardList,
    HandCoins,
    Info,
    Scale,
    Users,
} from "lucide-react";
import type { ReactNode } from "react";

export type GroupNavKey =
    | "om"
    | "medlemmer"
    | "arrangementer"
    | "boter"
    | "lovverk"
    | "sporreskjema";

export type GroupNavItem = {
    key: GroupNavKey;
    label: string;
    icon: ReactNode;
};

export const GROUP_NAV_ITEMS: GroupNavItem[] = [
    { key: "om", label: "Om", icon: <Info /> },
    { key: "medlemmer", label: "Medlemmer", icon: <Users /> },
    { key: "arrangementer", label: "Arrangementer", icon: <CalendarDays /> },
    { key: "boter", label: "Bøter", icon: <HandCoins /> },
    { key: "lovverk", label: "Lovverk", icon: <Scale /> },
    { key: "sporreskjema", label: "Spørreskjema", icon: <ClipboardList /> },
];
