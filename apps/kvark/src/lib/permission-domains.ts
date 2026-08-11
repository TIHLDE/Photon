import { PERMISSIONS } from "@photon/auth/rbac/registry";

/**
 * Domain-level view of the permission registry, for admin UIs.
 *
 * Instead of exposing all ~70 individual permissions as checkboxes, the UI
 * shows one checkbox per domain ("Arrangementer", "Nyheter", …). Toggling a
 * domain grants/removes every permission registered under it.
 *
 * There is deliberately no "Bøter" domain: giving and reading bøter follows
 * group membership rather than a permission, so there is nothing to tick.
 */

export type PermissionDomain = {
    slug: string;
    label: string;
    /**
     * Whether granting this domain scoped to a single group means anything.
     *
     * True only where the underlying rows carry an owning group AND the API
     * narrows against it. `events` has `organizerGroupSlug`, `forms` has
     * `formGroupForm.groupSlug`, `applications` has one per søknadstype, and
     * `roles` scopes to administering that group's own verv.
     *
     * For everything else there is nothing to narrow against — a `news` row
     * belongs to TIHLDE, not to Sosialen — so a group-scoped grant would pass
     * the coarse gate and then behave exactly like a global one. Rather than
     * offer a checkbox that quietly lies, those domains are only offered in
     * the "hele TIHLDE" section.
     */
    groupScopable: boolean;
};

/** Norwegian labels for the permission domains, in display order. */
export const PERMISSION_DOMAINS: PermissionDomain[] = [
    { slug: "events", label: "Arrangementer", groupScopable: true },
    { slug: "roles", label: "Roller", groupScopable: true },
    { slug: "forms", label: "Spørreskjema", groupScopable: true },
    { slug: "applications", label: "Søknader", groupScopable: true },
    { slug: "groups", label: "Grupper", groupScopable: false },
    { slug: "news", label: "Nyheter", groupScopable: false },
    { slug: "jobs", label: "Annonser", groupScopable: false },
    { slug: "contracts", label: "Kontrakter", groupScopable: false },
    { slug: "banners", label: "Bannere", groupScopable: false },
    { slug: "toddel", label: "Töddel", groupScopable: false },
    { slug: "galleries", label: "Galleri", groupScopable: false },
    { slug: "company-contact", label: "Kontaktskjema", groupScopable: false },
    { slug: "users", label: "Brukere", groupScopable: false },
    { slug: "api-keys", label: "API-nøkler", groupScopable: false },
    { slug: "oauth-clients", label: "OAuth-klienter", groupScopable: false },
];

/** The domains a group can hand to its members scoped to itself. */
export const GROUP_SCOPABLE_DOMAINS = PERMISSION_DOMAINS.filter(
    (d) => d.groupScopable,
);

const DOMAIN_LABELS = new Map(PERMISSION_DOMAINS.map((d) => [d.slug, d.label]));

/** Domain part of a permission, e.g. "events:registrations:view" → "events". */
export function domainOf(permission: string): string {
    const i = permission.indexOf(":");
    return i === -1 ? permission : permission.slice(0, i);
}

/** Domain slugs covered by a permission list. */
export function domainsOf(permissions: string[]): Set<string> {
    return new Set(permissions.map(domainOf));
}

/**
 * Every permission registered under a top-level domain, including nested ones
 * (e.g. "events" → events:view, …, events:registrations:view, …). Derived
 * from the auth registry so it stays in sync as permissions are added.
 */
export const PERMISSIONS_BY_DOMAIN: Record<string, readonly string[]> = (() => {
    const map: Record<string, string[]> = {};
    for (const perm of PERMISSIONS) {
        const dom = domainOf(perm);
        if (dom === perm) continue; // "root" has no domain
        const bucket = map[dom] ?? [];
        bucket.push(perm);
        map[dom] = bucket;
    }
    return map;
})();

/** Toggle a whole domain on/off in a permission list. */
export function toggleDomain(
    current: string[],
    domainSlug: string,
    checked: boolean,
): string[] {
    const perms = PERMISSIONS_BY_DOMAIN[domainSlug] ?? [];
    if (checked) {
        const next = new Set(current);
        for (const perm of perms) next.add(perm);
        return [...next];
    }
    return current.filter((p) => domainOf(p) !== domainSlug);
}

/**
 * Short human-readable summary of a permission list, e.g.
 * "Arrangementer, Bøter" or "Full tilgang (root)".
 */
export function summarizePermissions(permissions: string[]): string {
    if (permissions.includes("root")) return "Full tilgang (root)";
    const domains = [...domainsOf(permissions)]
        .map((d) => DOMAIN_LABELS.get(d) ?? d)
        .sort((a, b) => a.localeCompare(b, "nb"));
    return domains.length === 0 ? "Ingen tilganger" : domains.join(", ");
}
