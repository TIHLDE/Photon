import { format } from "date-fns";
import { nb } from "date-fns/locale";

import type {
    Group as ApiGroup,
    GroupMember as ApiGroupMember,
    Fine as ApiFine,
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
    user: string;
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
        name: member.user?.name ?? member.userId,
        image: member.user?.image ?? undefined,
        role: member.role,
        joined: formatGroupDate(member.createdAt),
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
        user: fine.userId,
        paragraph: "",
        title: fine.reason,
        amount: fine.amount,
        approved: fine.status === "approved" || fine.status === "paid",
        paid: fine.status === "paid",
        createdBy: fine.createdByUserId ?? "",
        date: fine.createdAt ? formatGroupDate(fine.createdAt) : "",
        reason: fine.reason,
        image: fine.image ?? undefined,
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
