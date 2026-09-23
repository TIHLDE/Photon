import {
    PERMISSIONS,
    isGroupScopablePermission,
} from "@photon/auth/rbac/registry";
import { union } from "es-toolkit";

/**
 * The permission checkboxes shown in the admin UI.
 *
 * One box per *job*, not per namespace. That distinction matters: the registry
 * groups by resource, but the people who do these jobs are not the same people.
 * Refunding a payment is not part of arranging an event, and IdKom handling
 * idrettsstøtte has no business in the Finansminister's utlegg — so those get
 * boxes of their own rather than riding along with a namespace they happen to
 * be nested under.
 *
 * Each box therefore carries an explicit permission list instead of a prefix.
 * A prefix would silently swallow every permission added under it later, which
 * is exactly how `events:payments:refund` ended up inside "Arrangementer".
 *
 * There is deliberately no "Bøter" box: giving and reading bøter follows group
 * membership rather than a permission, so there is nothing to tick.
 */

export type PermissionDomain = {
    /** Stable key. Not a registry prefix — see the note above. */
    slug: string;
    label: string;
    /** Exactly the permissions this box grants. */
    permissions: readonly string[];
};

/** Every registered permission starting with `prefix:`. */
function under(prefix: string): string[] {
    return PERMISSIONS.filter((p) => p.startsWith(`${prefix}:`));
}

/**
 * Arranging an event is one job, so registrations and the payment list ride
 * with it — whoever put the arrangement up handles who shows up and who paid.
 * Every one of those endpoints narrows to the event's organiser group, so a
 * group-scoped grant reaches that group's own arrangementer and nobody else's.
 *
 * Prikker for the group's own arrangementer ride with it too, but not as
 * checkboxes: the API reads `events:update` / `events:manage` for the
 * organiser group as the right to handle that event's prikker. The boxes below
 * therefore only have to say something about *other* groups' prikker, which is
 * what the org-wide "Prikker" box is for.
 *
 * Refunds are the exception, and the only one: moving money back out is a
 * separate decision that stays with whoever holds it explicitly.
 */
const EVENT_REFUND = "events:payments:refund";
const EVENT_STRIKES = under("events:strikes");

/**
 * Listed one by one rather than derived from the namespace, because the
 * namespace is wider than the API.
 *
 * `under("events")` handed out eighteen strings, and twelve of them are read
 * by no route at all — `events:feedback:create`, `events:payments:update` and
 * the rest are registry entries nobody ever wired up, while
 * `events:registrations:checkin` and friends are covered by `events:update`.
 * They granted nothing, but the box is atomic and you may only hand out what
 * you hold, so those dead strings were enough to make the whole box
 * unsaveable for every group leader whose list predates them. Only what the
 * API actually checks belongs here; add a line when a route starts reading
 * one.
 */
const EVENT_PERMISSIONS = [
    "events:create",
    "events:update",
    "events:delete",
    "events:manage",
    "events:registrations:view",
    "events:registrations:create",
    "events:payments:view",
];

/**
 * Søknader land on four different desks — utlegg with the Finansminister,
 * idrettsstøtte with IdKom, saker til HS with Hovedstyret — so each type is
 * its own box. Only utlegg and støtte carry a group the API narrows against;
 * the rest are org-wide by nature.
 */
export const PERMISSION_DOMAINS: PermissionDomain[] = [
    {
        slug: "events",
        label: "Arrangementer",
        permissions: EVENT_PERMISSIONS,
    },
    {
        slug: "events-strikes",
        label: "Prikker",
        permissions: EVENT_STRIKES,
    },
    {
        slug: "events-refund",
        label: "Refundering",
        permissions: [EVENT_REFUND],
    },
    {
        slug: "roles",
        label: "Tilganger",
        permissions: under("roles"),
    },
    {
        slug: "forms",
        label: "Spørreskjema",
        permissions: under("forms"),
    },
    {
        slug: "applications-expense",
        label: "Utlegg",
        permissions: under("applications:expense"),
    },
    {
        slug: "applications-support",
        label: "Støtte til HS",
        permissions: under("applications:support"),
    },
    {
        slug: "applications-sports-support",
        label: "Søknader – idrettsstøtte",
        permissions: under("applications:sports-support"),
    },
    {
        slug: "applications-hs-case",
        label: "Saker til HS",
        permissions: under("applications:hs-case"),
    },
    {
        slug: "applications-all",
        label: "Søknader – alle typer",
        permissions: ["applications:view", "applications:manage"],
    },
    {
        slug: "groups",
        label: "Grupper",
        permissions: under("groups"),
    },
    {
        slug: "news",
        label: "Nyheter",
        permissions: under("news"),
    },
    {
        slug: "jobs",
        label: "Annonser",
        permissions: under("jobs"),
    },
    {
        slug: "contracts",
        label: "Kontrakter",
        permissions: under("contracts"),
    },
    {
        slug: "banners",
        label: "Bannere",
        permissions: under("banners"),
    },
    {
        slug: "toddel",
        label: "Töddel",
        permissions: under("toddel"),
    },
    {
        slug: "galleries",
        label: "Galleri",
        permissions: under("galleries"),
    },
    {
        slug: "feedback",
        label: "Tilbakemeldinger",
        permissions: under("feedback"),
    },
    {
        slug: "company-contact",
        label: "Kontaktskjema",
        permissions: under("company-contact"),
    },
    {
        slug: "users",
        label: "Brukere",
        permissions: under("users"),
    },
    {
        slug: "api-keys",
        label: "API-nøkler",
        permissions: under("api-keys"),
    },
    {
        slug: "oauth-clients",
        label: "OAuth-klienter",
        permissions: under("oauth-clients"),
    },
];

/**
 * The part of a box that means something for a single group. "Grupper" for
 * one group is editing that group and its members — creating or deleting
 * groups can only be done for all of TIHLDE.
 */
export function scopedPermissionsOf(domain: PermissionDomain): string[] {
    return domain.permissions.filter(isGroupScopablePermission);
}

/** The boxes that can be handed out for a single group. */
export const GROUP_SCOPABLE_DOMAINS = PERMISSION_DOMAINS.filter(
    (d) => scopedPermissionsOf(d).length > 0,
);

/**
 * Drops what cannot apply to a single group from a group-scoped list. Such
 * leftovers grant nothing, and the API refuses to save them.
 */
export function onlyGroupScopable(permissions: string[]): string[] {
    return permissions.filter(isGroupScopablePermission);
}

const DOMAIN_BY_SLUG = new Map(PERMISSION_DOMAINS.map((d) => [d.slug, d]));
const DOMAIN_LABELS = new Map(PERMISSION_DOMAINS.map((d) => [d.slug, d.label]));

/**
 * Which boxes a permission list touches.
 *
 * A box counts as present as soon as ANY of its permissions is held — a
 * partial set (say, only `events:view`) still means "this group does something
 * with arrangementer", and the alternative would be to render it unticked and
 * then silently drop the rest on the next save.
 */
export function domainsOf(permissions: string[]): Set<string> {
    const held = new Set(permissions);
    const slugs = new Set<string>();
    for (const domain of PERMISSION_DOMAINS) {
        if (domain.permissions.some((p) => held.has(p))) slugs.add(domain.slug);
    }
    return slugs;
}

/**
 * Toggle a whole box on/off in a permission list. A group-scoped list only
 * receives the part of the box that can apply to a single group.
 */
export function toggleDomain(
    current: string[],
    domainSlug: string,
    checked: boolean,
    options: { scoped?: boolean } = {},
): string[] {
    const domain = DOMAIN_BY_SLUG.get(domainSlug);
    if (!domain) return current;

    if (checked) {
        return union(
            current,
            options.scoped ? scopedPermissionsOf(domain) : domain.permissions,
        );
    }
    // Removes exactly this box's permissions, so unticking "Arrangementer"
    // cannot take "Refusjon" with it just because they share a prefix.
    const removed = new Set(domain.permissions);
    return current.filter((p) => !removed.has(p));
}

/**
 * Short human-readable summary of a permission list, e.g.
 * "Arrangementer, Nyheter" or "Full tilgang (root)".
 */
export function summarizePermissions(permissions: string[]): string {
    if (permissions.includes("root")) return "Full tilgang (root)";
    const labels = [...domainsOf(permissions)]
        .map((slug) => DOMAIN_LABELS.get(slug) ?? slug)
        .sort((a, b) => a.localeCompare(b, "nb"));
    return labels.length === 0 ? "Ingen tilganger" : labels.join(", ");
}

/**
 * What a holder gets *on top of* what the group already gives every member,
 * e.g. "+ Arrangementer, Utlegg".
 *
 * A verv that repeats an access the whole group has adds nothing, and listing
 * it on the holder's row reads as if it were personal — usually a leftover
 * from before the group got the access. Only the difference is shown, and the
 * plus sign says it is a difference and not the whole picture.
 */
export function summarizeExtraPermissions(
    permissions: string[],
    covered: Set<string>,
): string {
    if (permissions.includes("root")) return "Full tilgang (root)";
    const labels = [...domainsOf(permissions)]
        .filter((slug) => !covered.has(slug))
        .map((slug) => DOMAIN_LABELS.get(slug) ?? slug)
        .sort((a, b) => a.localeCompare(b, "nb"));
    return labels.length === 0
        ? "Ingen egne tilganger"
        : `+ ${labels.join(", ")}`;
}

/**
 * The same summary for a holder with lists at more than one scope.
 *
 * Each list is measured against its own covered set: a group that gives every
 * member «Bannere» for its own banners does not cover a leader who may edit
 * everyone's, so that grant still has to show up on the row.
 */
export function summarizeExtraPermissionsByScope(
    entries: { permissions: string[]; covered: Set<string> }[],
): string {
    if (entries.some((entry) => entry.permissions.includes("root"))) {
        return "Full tilgang (root)";
    }
    const labels = new Set<string>();
    for (const { permissions, covered } of entries) {
        for (const slug of domainsOf(permissions)) {
            if (!covered.has(slug)) {
                labels.add(DOMAIN_LABELS.get(slug) ?? slug);
            }
        }
    }
    return labels.size === 0
        ? "Ingen egne tilganger"
        : `+ ${[...labels].sort((a, b) => a.localeCompare(b, "nb")).join(", ")}`;
}
