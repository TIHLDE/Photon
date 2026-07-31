import { format } from "date-fns";
import { nb } from "date-fns/locale";

import type {
    Group as ApiGroup,
    GroupMember as ApiGroupMember,
    GroupFormerMember as ApiGroupFormerMember,
    Fine as ApiFine,
    Law as ApiLaw,
    GroupFormList,
} from "@tihlde/sdk";

// -- Shared display types (previously in mock/group-detail) --

export type Group = {
    slug: string;
    name: string;
    description: string;
    contactEmail: string;
    imageUrl?: string;
    type?: string;
    leader?: string;
    finesInfo?: string;
    finesActivated?: boolean;
    botSjef?: string;
    botSystemPraktisk?: string;
};

export type Member = {
    id: string;
    name: string;
    joined: string;
    until?: string;
    role?: string;
    image?: string;
};

export type Fine = {
    id: string;
    userId: string;
    user: string;
    userImage?: string;
    paragraph: string;
    title: string;
    amount: number;
    approved: boolean;
    paid: boolean;
    createdBy: string;
    date: string;
    reason: string;
    image?: string;
};

export type Law = {
    id: string;
    paragraph: string;
    title: string;
    description: string;
    amount: number;
};

export type Form = {
    id: string;
    title: string;
    isOpen: boolean;
};

type ApiGroupForm = GroupFormList[number];

/**
 * Norske visningsnavn for gruppetyper. Databasen lagrer typen som UPPERCASE
 * (f.eks. "SUBGROUP"); i grensesnittet vil vi vise norske ord.
 */
const GROUP_TYPE_LABELS: Record<string, string> = {
    SUBGROUP: "Undergruppe",
    COMMITTEE: "Komité",
    BOARD: "Styre",
    INTERESTGROUP: "Interessegruppe",
    SPORTSTEAM: "Idrettslag",
    STUDYYEAR: "Klassetrinn",
    STUDY: "Studie",
    TIHLDE: "TIHLDE",
    PRIVATE: "Privat",
};

/**
 * Norsk visningsnavn for en gruppetype fra databasen (f.eks. "SUBGROUP").
 *
 * Oppslaget er case-insensitivt: typen er en fritekstkolonne, og en gruppe
 * lagret med annen skrivemåte skal ikke falle tilbake til det engelske ordet
 * — det var slik idrettslagene endte opp som «Sportsteam».
 */
export function groupTypeLabel(type: string): string {
    return (
        GROUP_TYPE_LABELS[type.toUpperCase()] ??
        type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    );
}

/**
 * Format an ISO timestamp as a Norwegian long date, e.g. "tor. 30. apr. 2026".
 */
export function formatGroupDate(iso: string): string {
    return format(new Date(iso), "EEE d. MMM yyyy", { locale: nb });
}

/**
 * Reduce a markdown group description to a short plain-text excerpt, for use
 * as a one-line subtitle. Strips headings, emphasis, links (keeping the link
 * text), images and horizontal rules, then truncates on a word boundary.
 */
export function groupDescriptionExcerpt(
    markdown: string,
    maxLength = 160,
): string {
    const text = markdown
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> link text
        .replace(/^#{1,6}\s+/gm, "") // headings
        .replace(/^(-{3,}|\*{3,})\s*$/gm, "") // horizontal rules
        .replace(/(\*\*|__|\*|_|`)/g, "") // emphasis/code markers
        .replace(/^[-*+]\s+/gm, "") // list bullets
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength);
    return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * Map an API group (detail response) to the display shape used by the header
 * and about tab. The list/detail endpoints do not expose a leader name, so
 * `leader` is left undefined unless supplied by the caller.
 */
export function mapGroup(group: ApiGroup, leader?: string): Group {
    return {
        slug: group.slug,
        name: group.name,
        description: group.description ?? "",
        contactEmail: group.contactEmail ?? "",
        imageUrl: group.imageUrl ?? undefined,
        type: group.type,
        leader,
        finesInfo: group.finesInfo,
        finesActivated: group.finesActivated,
    };
}

/**
 * Map an API group membership to a display member.
 * The members endpoint includes public user info (name/image); fall back to
 * the userId if the user relation is missing for some reason.
 */
export function mapMember(member: ApiGroupMember): Member {
    return {
        id: member.userId,
        name: member.user?.name ?? "Ukjent bruker",
        image: member.user?.image ?? undefined,
        role: member.role,
        joined: formatGroupDate(member.createdAt),
    };
}

/**
 * Norske navn på rollene et avsluttet medlemskap kan ha hatt. Photon har bare
 * member/leader, men historikken er backfilt fra Lepton, som lagret styreverv
 * i samme felt og i STORE BOKSTAVER.
 */
const MEMBER_ROLE_LABELS: Record<string, string> = {
    leader: "Leder",
    deputy_leader: "Nestleder",
    treasurer: "Økonomiansvarlig",
    chairman: "Styreleder",
    vice_chairman: "Nestleder",
};

/**
 * Norsk visningsnavn for en rolle i et avsluttet medlemskap, eller `undefined`
 * for vanlige medlemmer — «· Medlem» bak datoene er bare støy.
 */
function formerMemberRoleLabel(role: string): string | undefined {
    const key = role.toLowerCase();
    if (key === "member" || key === "") return undefined;
    return MEMBER_ROLE_LABELS[key] ?? role;
}

/**
 * Map an avsluttet medlemskap to a display member. `until` er satt, som er
 * det `GroupMemberRow` bruker for å vise «medlem fra → til».
 */
export function mapFormerMember(member: ApiGroupFormerMember): Member {
    return {
        id: member.userId,
        name: member.user?.name ?? "Ukjent bruker",
        image: member.user?.image ?? undefined,
        role: formerMemberRoleLabel(member.role),
        joined: formatGroupDate(member.startedAt),
        until: formatGroupDate(member.endedAt),
    };
}

/**
 * Map an API fine to the display shape used by the fines tab.
 * The backend has no law/paragraph system, so `paragraph`/`title` are empty.
 * `status` is one of pending | approved | paid | rejected.
 */
export function mapFine(fine: ApiFine): Fine {
    return {
        id: fine.id,
        userId: fine.userId,
        user: fine.user?.name ?? "Ukjent bruker",
        userImage: fine.user?.image ?? undefined,
        paragraph: "",
        title: fine.reason,
        amount: fine.amount,
        approved: fine.status === "approved" || fine.status === "paid",
        paid: fine.status === "paid",
        createdBy: fine.createdByUser?.name ?? "",
        date: fine.createdAt ? formatGroupDate(fine.createdAt) : "",
        reason: fine.reason,
        image: fine.image ?? undefined,
    };
}

/**
 * Map an API law to the display shape used by the laws tab and fine dialogs.
 * The backend stores `paragraph` as a decimal string ("3.10"); trailing
 * zeros are stripped for display ("3.1", "1").
 */
export function mapLaw(law: ApiLaw): Law {
    return {
        id: law.id,
        paragraph: String(Number(law.paragraph)),
        title: law.title,
        description: law.description,
        amount: law.amount,
    };
}

/**
 * Map an API group form to the display shape used by the forms tab.
 */
export function mapForm(form: ApiGroupForm): Form {
    return {
        id: form.id,
        title: form.title,
        isOpen: form.is_open_for_submissions,
    };
}
