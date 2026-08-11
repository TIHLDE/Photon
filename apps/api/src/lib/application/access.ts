import { getUserPermissions, hasPermission } from "@photon/auth/rbac";
import {
    type ApplicationType,
    applicationTypeVariants,
} from "@photon/db/schema";
import type { AppContext } from "~/lib/ctx";

/**
 * The søknad types that belong to a group, and can therefore be handled by
 * that group alone.
 *
 * Utlegg and støttesøknader carry a `groupSlug`; saker til HS and
 * bedriftshenvendelser do not belong to anyone in particular, so a
 * group-scoped grant for them would have nothing to narrow against and is
 * ignored rather than silently treated as global.
 */
const GROUP_OWNED_TYPES = new Set<ApplicationType>(["expense", "support"]);

/**
 * Who may see and handle which søknad type.
 *
 * The types land on different desks — utlegg with the Finansminister,
 * idrettslagsstøtte with IdKom, saker til HS with Hovedstyret,
 * bedriftshenvendelser with the Næringslivsminister — so each has its own
 * permission pair. `applications:view` / `applications:manage` are the
 * all-types grants held by root and admin.
 *
 * Bedriftshenvendelser sit outside the `applications` domain entirely: they
 * are their own `company-contact:*` grant, so handling søknader — even with
 * the all-types grant — does not hand out the kontaktskjema inbox.
 */
const permissionsByType: Record<
    ApplicationType,
    { view: string[]; manage: string[] }
> = {
    expense: {
        view: ["applications:view", "applications:expense:view"],
        manage: ["applications:manage", "applications:expense:manage"],
    },
    support: {
        view: ["applications:view", "applications:support:view"],
        manage: ["applications:manage", "applications:support:manage"],
    },
    sports_support: {
        view: ["applications:view", "applications:sports-support:view"],
        manage: ["applications:manage", "applications:sports-support:manage"],
    },
    hs_case: {
        view: ["applications:view", "applications:hs-case:view"],
        manage: ["applications:manage", "applications:hs-case:manage"],
    },
    company_contact: {
        view: ["company-contact:view"],
        manage: ["company-contact:manage"],
    },
};

/** Permissions that let someone read a søknad of this type. */
export function viewPermissionsFor(type: ApplicationType): string[] {
    return permissionsByType[type].view;
}

/** Permissions that let someone change the status of a søknad of this type. */
export function managePermissionsFor(type: ApplicationType): string[] {
    return permissionsByType[type].manage;
}

/**
 * Every view/manage permission across all types. Used as the cheap up-front
 * gate on the admin routes — the per-row check still runs in the handler,
 * because the middleware cannot know a row's type from the URL.
 */
export const ALL_VIEW_PERMISSIONS = applicationTypeVariants.flatMap((type) =>
    viewPermissionsFor(type),
);

export const ALL_MANAGE_PERMISSIONS = applicationTypeVariants.flatMap((type) =>
    managePermissionsFor(type),
);

/**
 * What a user may do with a søknad type: every group's, or only some.
 *
 * `groupSlugs: null` is the org-wide case — the Finansminister handles utlegg
 * from anyone. A non-null list is what a group-scoped grant produces: NoK's
 * members handling NoK's own utlegg and nobody else's.
 */
export type ApplicationAccess = {
    type: ApplicationType;
    groupSlugs: string[] | null;
};

/**
 * Group slugs a user holds any of `permissions` for, scoped to that group.
 *
 * Reads the flattened effective permissions rather than the direct-grant table
 * so it sees every source — verv, leadership, and the group's own member
 * permissions.
 */
function scopedGroupSlugs(
    effective: string[],
    permissions: string[],
): string[] {
    const wanted = new Set(permissions);
    const slugs = new Set<string>();

    for (const raw of effective) {
        const at = raw.indexOf("@");
        if (at === -1) continue;
        const name = raw.slice(0, at);
        const scope = raw.slice(at + 1);
        if (!wanted.has(name)) continue;
        if (!scope.startsWith("group:")) continue;
        slugs.add(scope.slice("group:".length));
    }

    return [...slugs];
}

async function applicationAccess(
    ctx: AppContext,
    userId: string,
    permissionsFor: (type: ApplicationType) => string[],
): Promise<ApplicationAccess[]> {
    const effective = await getUserPermissions(ctx, userId);
    const access: ApplicationAccess[] = [];

    for (const type of applicationTypeVariants) {
        const permissions = permissionsFor(type);

        if (await hasPermission(ctx, userId, permissions)) {
            access.push({ type, groupSlugs: null });
            continue;
        }

        if (!GROUP_OWNED_TYPES.has(type)) continue;

        const groupSlugs = scopedGroupSlugs(effective, permissions);
        if (groupSlugs.length > 0) access.push({ type, groupSlugs });
    }

    return access;
}

/**
 * The søknader this user may read, and for which groups. Drives the admin list
 * query and the type tabs in the admin UI, so a Finansminister never learns
 * that a sak til HS exists.
 */
export async function visibleApplicationAccess(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationAccess[]> {
    return await applicationAccess(ctx, userId, viewPermissionsFor);
}

/** The søknad types this user may read, ignoring which groups' they are. */
export async function visibleApplicationTypes(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationType[]> {
    return (await visibleApplicationAccess(ctx, userId)).map((a) => a.type);
}

/** The søknader this user may change the status of, and for which groups. */
export async function manageableApplicationAccess(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationAccess[]> {
    return await applicationAccess(ctx, userId, managePermissionsFor);
}

/** The søknad types this user may change the status of. */
export async function manageableApplicationTypes(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationType[]> {
    return (await manageableApplicationAccess(ctx, userId)).map((a) => a.type);
}

/**
 * Whether `access` covers a specific søknad — the type must be in it, and the
 * grant must either be org-wide or name the group the søknad belongs to.
 */
export function accessCovers(
    access: ApplicationAccess[],
    type: ApplicationType,
    groupSlug: string | null | undefined,
): boolean {
    const entry = access.find((a) => a.type === type);
    if (!entry) return false;
    if (entry.groupSlugs === null) return true;
    return Boolean(groupSlug) && entry.groupSlugs.includes(groupSlug as string);
}

/**
 * The group a søknad belongs to, or null for the types that belong to nobody
 * in particular (saker til HS, bedriftshenvendelser).
 */
export function applicationGroupSlug(application: {
    expense?: { groupSlug?: string | null } | null;
    support?: { groupSlug?: string | null } | null;
}): string | null {
    return (
        application.expense?.groupSlug ?? application.support?.groupSlug ?? null
    );
}
