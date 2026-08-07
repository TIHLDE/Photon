import { format } from "date-fns";
import { nb } from "date-fns/locale";

import type {
    Group as ApiGroup,
    GroupMember as ApiGroupMember,
    GroupFormerMember as ApiGroupFormerMember,
    Fine as ApiFine,
    FineUserList,
    Law as ApiLaw,
    GroupFormList,
} from "@tihlde/sdk";

type ApiFineUser = FineUserList["users"][number];

// -- Shared display types (previously in mock/group-detail) --

export type Group = {
    slug: string;
    name: string;
    description: string;
    contactEmail: string;
    /** Gruppebilde: bredt bilde av gruppa, vises på Om-fanen. */
    imageUrl?: string;
    /** Logo: kvadratisk merke, vises i avatarer og kort. */
    logoUrl?: string;
    type?: string;
    leader?: string;
    finesInfo?: string;
    finesActivated?: boolean;
    /** Botsjefen. Null når gruppen ikke har utpekt noen. */
    finesAdminId?: string | null;
};

export type Member = {
    id: string;
    username?: string;
    name: string;
    joined: string;
    until?: string;
    role?: string;
    image?: string;
};

/**
 * Botens tilstand. Ett felt, ikke to boolske — «godkjent» og «betalt» er
 * trinn i samme forløp, og kombinasjoner som «betalt, men ikke godkjent»
 * finnes ikke.
 */
export type FineStatus = "pending" | "approved" | "paid" | "rejected";

export type Fine = {
    id: string;
    userId: string;
    user: string;
    userImage?: string;
    paragraph: string;
    title: string;
    /**
     * Om boten er koblet til en paragraf i gruppens lovverk. Uten kobling
     * faller `title` tilbake på begrunnelsen, og da må dialogen la være å
     * vise den samme teksten to ganger.
     */
    hasLaw: boolean;
    amount: number;
    status: FineStatus;
    approved: boolean;
    paid: boolean;
    createdBy: string;
    date: string;
    reason: string;
    defense: string;
    image?: string;
};

/** Ett medlem i «Per medlem»-visningen. */
export type FineUser = {
    id: string;
    name: string;
    image?: string;
    /** Summen av medlemmets bøter, 0 for medlemmer uten bøter. */
    finesAmount: number;
    finesCount: number;
};

export type FineStatistics = {
    notApproved: number;
    approvedNotPaid: number;
    paid: number;
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
    description: string;
    isOpen: boolean;
    /** Om samme person kan sende inn flere svar. */
    canSubmitMultiple: boolean;
    onlyForMembers: boolean;
    /** E-post som varsles ved nye svar. Tom streng når ingen er satt. */
    emailReceiver: string;
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
 * Om gruppa bare er for medlemmene sine.
 *
 * En PRIVAT gruppe (digital transformasjon-faddergruppa er eksempelet) står
 * fortsatt oppført der medlemskap listes, men siden, medlemslista og vervene
 * svarer 403 for alle andre enn medlemmene. Bruk denne til å la være å lenke
 * dit i stedet for å sende folk til en feilmelding.
 *
 * Case-insensitiv: typen er en fritekstkolonne, og radene fra Lepton er
 * store bokstaver.
 */
export function isPrivateGroupType(type: string): boolean {
    return type.toUpperCase() === "PRIVATE";
}

/**
 * Format an ISO timestamp as a Norwegian long date, e.g. "tor. 30. apr. 2026".
 */
export function formatGroupDate(iso: string): string {
    return format(new Date(iso), "EEE d. MMM yyyy", { locale: nb });
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
        logoUrl: group.logoUrl ?? undefined,
        type: group.type,
        leader,
        finesInfo: group.finesInfo,
        finesActivated: group.finesActivated,
        finesAdminId: group.finesAdminId ?? null,
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
        username: member.user?.username ?? undefined,
        name: member.user?.name ?? "Ukjent bruker",
        image: member.user?.image ?? undefined,
        role: member.role,
        joined: formatGroupDate(member.createdAt),
    };
}

/**
 * Medlemsendepunktet har ingen `orderBy`, så radene kommer i den rekkefølgen
 * Postgres finner dem — i praksis innsettingsrekkefølge. Det ser nesten
 * alfabetisk ut fordi Lepton-importen la dem inn slik, mens alle som er meldt
 * inn etterpå havner bakerst.
 *
 * Sorteringen gjøres her og ikke i SQL fordi Postgres' standardkollasjon
 * sorterer Æ, Ø og Å før Z. `Intl.Collator("nb")` gir riktig norsk rekkefølge:
 * Zara, Ærlend, Øystein, Åse.
 */
const memberNameCollator = new Intl.Collator("nb");

export function sortMembersByName<T extends { name: string }>(
    members: T[],
): T[] {
    return [...members].sort((a, b) =>
        memberNameCollator.compare(a.name, b.name),
    );
}

/**
 * Norske navn på rollene et avsluttet medlemskap kan ha hatt. Både Photon og
 * Lepton-historikken kjenner bare member/leader — kolonnen er fritekst, så en
 * ukjent verdi vises som den er i stedet for å bli borte.
 */
const MEMBER_ROLE_LABELS: Record<string, string> = {
    leader: "Leder",
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
        username: member.user?.username ?? undefined,
        name: member.user?.name ?? "Ukjent bruker",
        image: member.user?.image ?? undefined,
        role: formerMemberRoleLabel(member.role),
        joined: formatGroupDate(member.startedAt),
        until: formatGroupDate(member.endedAt),
    };
}

/**
 * Paragrafnummeret slik det skal leses. Desimalene er et paragrafnummer på to
 * siffer, ikke en brøkdel: 3.01 og 3.10 er to forskjellige paragrafer, så
 * begge desimalene må stå ("3.10", aldri "3.1"). Heltall er overskrifter og
 * vises uten desimaler ("1").
 */
function formatParagraph(paragraph: string): string {
    const value = Number(paragraph);
    if (!Number.isFinite(value)) return paragraph;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Map an API fine to the display shape used by the fines tab.
 *
 * Bøter gitt uten paragraf — alt som ble migrert fra Lepton, og bøter i
 * grupper uten lovverk — har ingen `law`. Da står paragrafen tom og
 * begrunnelsen brukes som tittel, slik det var før koblingen fantes.
 * `status` is one of pending | approved | paid | rejected.
 */
export function mapFine(fine: ApiFine): Fine {
    return {
        id: fine.id,
        userId: fine.userId,
        user: fine.user?.name ?? "Ukjent bruker",
        userImage: fine.user?.image ?? undefined,
        paragraph: fine.law ? formatParagraph(fine.law.paragraph) : "",
        title: fine.law?.title ?? fine.reason,
        hasLaw: fine.law != null,
        amount: fine.amount,
        status: (fine.status as FineStatus) ?? "pending",
        approved: fine.status === "approved" || fine.status === "paid",
        paid: fine.status === "paid",
        createdBy: fine.createdByUser?.name ?? "",
        date: fine.createdAt ? formatGroupDate(fine.createdAt) : "",
        reason: fine.reason,
        defense: fine.defense ?? "",
        image: fine.image ?? undefined,
    };
}

/** Map a member row from the "bøter per medlem" endpoint. */
export function mapFineUser(user: ApiFineUser): FineUser {
    return {
        id: user.id,
        name: user.name,
        image: user.image ?? undefined,
        finesAmount: user.finesAmount,
        finesCount: user.finesCount,
    };
}

/**
 * Map an API law to the display shape used by the laws tab and fine dialogs.
 * The backend stores `paragraph` as a decimal string ("3.10"), som vises slik
 * den er lagret — se {@link formatParagraph}.
 */
export function mapLaw(law: ApiLaw): Law {
    return {
        id: law.id,
        paragraph: formatParagraph(law.paragraph),
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
        description: form.description ?? "",
        isOpen: form.is_open_for_submissions,
        canSubmitMultiple: form.can_submit_multiple,
        onlyForMembers: form.only_for_group_members,
        emailReceiver: form.email_receiver_on_submit ?? "",
    };
}
