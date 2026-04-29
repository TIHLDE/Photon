import {
    CalendarDays,
    HelpCircle,
    LayoutGrid,
    Settings,
    ShieldCheck,
    Ticket,
    UserCircle2,
} from "lucide-react";
import type { ReactNode } from "react";

export type ProfileNavKey =
    | "oversikt"
    | "arrangementer"
    | "medlemskap"
    | "prikker"
    | "spørreskjemaer"
    | "innstillinger"
    | "admin";

export type ProfileNavItem = {
    key: ProfileNavKey;
    label: string;
    icon: ReactNode;
};

export const PROFILE_PRIMARY_NAV: ProfileNavItem[] = [
    { key: "oversikt", label: "Oversikt", icon: <LayoutGrid /> },
    { key: "arrangementer", label: "Arrangementer", icon: <CalendarDays /> },
    { key: "medlemskap", label: "Medlemskap", icon: <UserCircle2 /> },
    { key: "prikker", label: "Prikker", icon: <Ticket /> },
    { key: "spørreskjemaer", label: "Spørreskjemaer", icon: <HelpCircle /> },
];

export const PROFILE_SECONDARY_NAV: ProfileNavItem[] = [
    { key: "innstillinger", label: "Innstillinger", icon: <Settings /> },
    { key: "admin", label: "Admin", icon: <ShieldCheck /> },
];
