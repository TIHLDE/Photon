import type { ProfileEventRowProps } from "#/components/profile-event-row";
import type { ProfileHeaderUser } from "#/components/profile-header";
import type { ProfileStatCardProps } from "#/components/profile-stat-card";
import type { ProfileTodoRowProps } from "#/components/profile-todo-row";

export const USER: ProfileHeaderUser = {
    name: "Aleksander Hjortkær Sand Evensen",
    username: "ahevense",
    email: "ahevense@stud.ntnu.no",
    programme: "2. klasse Dataingeniør",
    links: [
        { kind: "github", label: "github" },
        { kind: "linkedin", label: "linkedin" },
    ],
};

export const STATS: ProfileStatCardProps[] = [
    {
        label: "NESTE ARRANGEMENT",
        title: "Bedpres · Bekk",
        description: "tor 24. apr · 17:00",
    },
    {
        label: "MEDLEMSKAP",
        title: "Aktiv",
        description: "fornyes 2026-08-01",
    },
    {
        label: "PRIKKER",
        title: "0 aktive",
        description: "alt i orden",
    },
];

export const UPCOMING: ProfileEventRowProps[] = [
    {
        title: "Bedpres · Bekk",
        meta: "tor 24. apr · Realfagbygget R2",
        status: "påmeldt",
        statusVariant: "secondary",
    },
    {
        title: "Fagkveld: AI & produksjon",
        meta: "ons 30. apr · Digs",
        status: "venteliste #3",
        statusVariant: "outline",
    },
];

export const TODOS: ProfileTodoRowProps[] = [
    {
        title: "Spørreskjema: Vårfest 2026",
        meta: "utløper om 3 dager",
        action: "Svar",
    },
];
