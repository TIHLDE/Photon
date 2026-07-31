import { hasPermission } from "@photon/auth/rbac";
import {
    type ApplicationType,
    applicationTypeVariants,
} from "@photon/db/schema";
import type { AppContext } from "~/lib/ctx";

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
 * The søknad types this user may read. Drives the admin list query and the
 * type tabs in the admin UI, so a Finansminister never learns that a sak til
 * HS exists.
 */
export async function visibleApplicationTypes(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationType[]> {
    const visible: ApplicationType[] = [];

    for (const type of applicationTypeVariants) {
        if (await hasPermission(ctx, userId, viewPermissionsFor(type))) {
            visible.push(type);
        }
    }

    return visible;
}

/** The søknad types this user may change the status of. */
export async function manageableApplicationTypes(
    ctx: AppContext,
    userId: string,
): Promise<ApplicationType[]> {
    const manageable: ApplicationType[] = [];

    for (const type of applicationTypeVariants) {
        if (await hasPermission(ctx, userId, managePermissionsFor(type))) {
            manageable.push(type);
        }
    }

    return manageable;
}
