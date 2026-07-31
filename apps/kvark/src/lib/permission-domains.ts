import { PERMISSIONS } from "@photon/auth/rbac/registry";

/**
 * Domain-level view of the permission registry, for admin UIs.
 *
 * Instead of exposing all ~70 individual permissions as checkboxes, the UI
 * shows one checkbox per domain ("Arrangementer", "Bøter", …). Toggling a
 * domain grants/removes every permission registered under it — mirroring how
 * aarhonen's role admin works.
 */

export type PermissionDomain = {
    slug: string;
    label: string;
};

/** Norwegian labels for the permission domains, in display order. */
export const PERMISSION_DOMAINS: PermissionDomain[] = [
    { slug: "events", label: "Arrangementer" },
    { slug: "groups", label: "Grupper" },
    { slug: "fines", label: "Bøter" },
    { slug: "news", label: "Nyheter" },
    { slug: "jobs", label: "Annonser" },
    { slug: "forms", label: "Spørreskjema" },
    { slug: "contracts", label: "Kontrakter" },
    { slug: "banners", label: "Bannere" },
    { slug: "applications", label: "Søknader" },
    { slug: "company-contact", label: "Kontaktskjema" },
    { slug: "users", label: "Brukere" },
    { slug: "roles", label: "Roller" },
    { slug: "api-keys", label: "API-nøkler" },
    { slug: "oauth-clients", label: "OAuth-klienter" },
];

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
