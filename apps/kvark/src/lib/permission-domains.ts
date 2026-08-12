import { PERMISSIONS } from "@photon/auth/rbac/registry";

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
    /**
     * Whether granting this scoped to a single group means anything.
     *
     * True only where the rows carry an owning group AND the API narrows
     * against it. Everything else would pass the coarse gate and then behave
     * exactly like a global grant, so it is offered only under "hele TIHLDE"
     * rather than as a checkbox that quietly lies.
     */
    groupScopable: boolean;
    /** Exactly the permissions this box grants. */
    permissions: readonly string[];
};

/** Every registered permission starting with `prefix:`. */
function under(prefix: string): string[] {
    return PERMISSIONS.filter((p) => p.startsWith(`${prefix}:`));
}

/**
 * Arranging an event is one job, so registrations, feedback, payments and
 * prikker ride with it — whoever put the arrangement up handles who shows up,
 * who paid and who never turned up. Every one of those endpoints narrows to
 * the event's organiser group, so a group-scoped grant reaches that group's
 * own arrangementer and nobody else's.
 *
 * Refunds are the exception, and the only one: moving money back out is a
 * separate decision that stays with whoever holds it explicitly.
 */
const EVENT_REFUND = "events:payments:refund";
const EVENT_PERMISSIONS = under("events").filter((p) => p !== EVENT_REFUND);

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
        groupScopable: true,
        permissions: EVENT_PERMISSIONS,
    },
    {
        slug: "events-refund",
        label: "Refusjon av betalinger",
        // The refund route accepts a global grant only, so offering this per
        // group would be a checkbox that saves and then does nothing.
        groupScopable: false,
        permissions: [EVENT_REFUND],
    },
    {
        slug: "roles",
        label: "Verv og tilganger",
        groupScopable: true,
        permissions: under("roles"),
    },
    {
        slug: "forms",
        label: "Spørreskjema",
        groupScopable: true,
        permissions: under("forms"),
    },
    {
        slug: "applications-expense",
        label: "Søknader – utlegg",
        groupScopable: true,
        permissions: under("applications:expense"),
    },
    {
        slug: "applications-support",
        label: "Søknader – støtte",
        groupScopable: true,
        permissions: under("applications:support"),
    },
    {
        slug: "applications-sports-support",
        label: "Søknader – idrettsstøtte",
        groupScopable: false,
        permissions: under("applications:sports-support"),
    },
    {
        slug: "applications-hs-case",
        label: "Søknader – saker til HS",
        groupScopable: false,
        permissions: under("applications:hs-case"),
    },
    {
        slug: "applications-all",
        label: "Søknader – alle typer",
        groupScopable: false,
        permissions: ["applications:view", "applications:manage"],
    },
    {
        slug: "groups",
        label: "Grupper",
        groupScopable: false,
        permissions: under("groups"),
    },
    {
        slug: "news",
        label: "Nyheter",
        groupScopable: false,
        permissions: under("news"),
    },
    {
        slug: "jobs",
        label: "Annonser",
        groupScopable: false,
        permissions: under("jobs"),
    },
    {
        slug: "contracts",
        label: "Kontrakter",
        groupScopable: false,
        permissions: under("contracts"),
    },
    {
        slug: "banners",
        label: "Bannere",
        groupScopable: false,
        permissions: under("banners"),
    },
    {
        slug: "toddel",
        label: "Töddel",
        groupScopable: false,
        permissions: under("toddel"),
    },
    {
        slug: "galleries",
        label: "Galleri",
        groupScopable: false,
        permissions: under("galleries"),
    },
    {
        slug: "company-contact",
        label: "Kontaktskjema",
        groupScopable: false,
        permissions: under("company-contact"),
    },
    {
        slug: "users",
        label: "Brukere",
        groupScopable: false,
        permissions: under("users"),
    },
    {
        slug: "api-keys",
        label: "API-nøkler",
        groupScopable: false,
        permissions: under("api-keys"),
    },
    {
        slug: "oauth-clients",
        label: "OAuth-klienter",
        groupScopable: false,
        permissions: under("oauth-clients"),
    },
];

/** The boxes a group can hand to its members scoped to itself. */
export const GROUP_SCOPABLE_DOMAINS = PERMISSION_DOMAINS.filter(
    (d) => d.groupScopable,
);

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

/** Toggle a whole box on/off in a permission list. */
export function toggleDomain(
    current: string[],
    domainSlug: string,
    checked: boolean,
): string[] {
    const domain = DOMAIN_BY_SLUG.get(domainSlug);
    if (!domain) return current;

    if (checked) {
        return [...new Set([...current, ...domain.permissions])];
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
