/**
 * Permission registry and type definitions.
 *
 * This module defines all available permissions in the system using a
 * nested structure that generates type-safe permission strings.
 */

// =============================================================================
// Permission Registry
// =============================================================================

/**
 * Nested permission registry.
 *
 * Structure:
 * - Each domain has an `actions` array for direct permissions
 * - Nested sub-domains are objects with their own `actions`
 *
 * This generates permissions like:
 * - "events:view", "events:create" (from events.actions)
 * - "events:registrations:view" (from events.registrations.actions)
 */
export const PERMISSION_REGISTRY = {
    // System permissions
    roles: {
        actions: ["view", "create", "update", "delete", "assign"],
    },
    users: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    "api-keys": {
        actions: ["view", "create", "update", "delete"],
    },
    "oauth-clients": {
        actions: ["view", "create", "update", "delete", "manage"],
    },

    // Event permissions
    events: {
        actions: ["view", "create", "update", "delete", "manage"],
        registrations: {
            actions: ["view", "create", "delete", "checkin", "manage"],
        },
        feedback: {
            actions: ["view", "create", "update", "delete"],
        },
        payments: {
            actions: ["view", "create", "update", "delete", "refund"],
        },
        strikes: {
            actions: ["view", "create", "delete"],
        },
    },

    // Group permissions
    groups: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    /**
     * No `fines` domain, deliberately. Giving and reading bøter is what being
     * in a group IS, so it follows membership instead: any member sees every
     * fine in their group and may hand one out, the botsjef and the leader
     * settle them, and root is the only cross-group access. A checkbox here
     * would have meant configuring 60 groups to get their baseline behaviour,
     * and the permission was global anyway — so a group-scoped grant was
     * silently rejected while a global one opened every group's bøter at once.
     */
    contracts: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    forms: {
        actions: ["view", "create", "update", "delete", "manage"],
    },

    // News permissions
    news: {
        actions: ["view", "create", "update", "delete", "manage"],
        reactions: {
            actions: ["create", "delete"],
        },
    },

    // Gallery permissions ("galleri" — albums and the pictures in them)
    galleries: {
        actions: ["view", "create", "update", "delete", "manage"],
        pictures: {
            actions: ["create", "update", "delete"],
        },
    },

    /**
     * TÖDDEL, the student magazine. There is no "view" action: the archive is
     * a public endpoint, so the only permissions worth handing out are the
     * ones that publish or withdraw an issue.
     */
    toddel: {
        actions: ["create", "update", "delete", "manage"],
    },

    // Job permissions
    jobs: {
        actions: ["view", "create", "update", "delete", "manage"],
    },

    // Front-page banner permissions
    banners: {
        actions: ["view", "create", "update", "delete", "manage"],
    },

    /**
     * Søknader (utlegg, støttesøknader, saker til HS).
     *
     * There is deliberately no "create" action — submitting an application is
     * a plain member right, so those routes only require authentication. The
     * sub-domains exist because the types are handled by different people:
     * utlegg by the Finansminister, idrettslagsstøtte by IdKom, saker til HS
     * by Hovedstyret. The top-level view/manage pair is the all-types grant
     * held by root/admin.
     *
     * Bedriftshenvendelser are NOT part of this domain — see
     * {@link PERMISSION_REGISTRY.company-contact}.
     */
    applications: {
        actions: ["view", "manage"],
        expense: {
            actions: ["view", "manage"],
        },
        support: {
            actions: ["view", "manage"],
        },
        "sports-support": {
            actions: ["view", "manage"],
        },
        "hs-case": {
            actions: ["view", "manage"],
        },
    },

    /**
     * Tilbakemeldinger — idéer og feilmeldinger fra medlemmer.
     *
     * There is deliberately no "view" or "create" action: reading the list and
     * filing an idea is what the page is for, so those routes only require
     * being logged in. Authors may edit and delete their own entry without any
     * grant. What is left to hand out is moderating everyone else's — setting
     * status as the reports are worked through, removing spam — which is
     * Index's job.
     */
    feedback: {
        actions: ["update", "delete", "manage"],
    },

    /**
     * Kontaktskjema — henvendelser bedrifter sender inn via bedriftssiden.
     *
     * Its own top-level domain rather than a søknad sub-domain: the
     * Næringslivsministeren handles these and nothing else, and whoever
     * handles søknader has no business reading company enquiries. That
     * separation is what makes it a checkbox of its own in the role admin.
     */
    "company-contact": {
        actions: ["view", "manage"],
    },
} as const;

/**
 * Special permissions that don't follow the domain:action pattern.
 * "root" grants access to everything.
 */
export const SPECIAL_PERMISSIONS = ["root"] as const;

// =============================================================================
// Type Utilities
// =============================================================================

type Registry = typeof PERMISSION_REGISTRY;

/** Node in the permission tree - has actions and optional nested domains */
type PermissionNode = {
    readonly actions: readonly string[];
    readonly [key: string]: readonly string[] | PermissionNode;
};

/** Recursively extract permissions from nested registry */
type ExtractPermissions<
    T extends PermissionNode,
    Prefix extends string = "",
> = {
    [K in keyof T]: K extends "actions"
        ? T[K] extends readonly string[]
            ? `${Prefix}${T[K][number]}`
            : never
        : T[K] extends PermissionNode
          ? ExtractPermissions<T[K], `${Prefix}${K & string}:`>
          : never;
}[keyof T];

type PermissionFromRegistry = {
    [K in keyof Registry]: Registry[K] extends PermissionNode
        ? ExtractPermissions<Registry[K], `${K & string}:`>
        : never;
}[keyof Registry];

type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

/**
 * Union type of all valid permission names.
 * Examples: "events:create", "events:registrations:view", "root"
 */
export type Permission = PermissionFromRegistry | SpecialPermission;

/**
 * Recursively flattens the nested permission registry into permission strings.
 */
function flattenPermissionRegistry(
    node: PermissionNode,
    prefix: string,
): string[] {
    const names: string[] = [];

    for (const key of Object.keys(node)) {
        const value = node[key];

        if (key === "actions" && Array.isArray(value)) {
            // Add all actions with current prefix
            for (const action of value) {
                names.push(`${prefix}${action}`);
            }
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
        ) {
            // Recurse into nested domain
            names.push(
                ...flattenPermissionRegistry(
                    value as PermissionNode,
                    `${prefix}${key}:`,
                ),
            );
        }
    }

    return names;
}

/**
 * Flattens the entire registry from all top-level domains.
 */
function flattenRegistry(registry: Registry): string[] {
    const names: string[] = [];
    for (const domain of Object.keys(registry)) {
        const node = registry[domain as keyof Registry] as PermissionNode;
        names.push(...flattenPermissionRegistry(node, `${domain}:`));
    }
    return names;
}

/**
 * Array of all valid permissions in the system.
 */
export const PERMISSIONS: readonly string[] = Object.freeze([
    ...flattenRegistry(PERMISSION_REGISTRY),
    ...SPECIAL_PERMISSIONS,
]);

/**
 * Set of all valid permission names for O(1) lookup.
 */
export const PERMISSIONS_SET = new Set<string>(PERMISSIONS);

/**
 * Type guard to check if a string is a valid permission.
 */
export function isPermission(name: string): name is Permission {
    return PERMISSIONS_SET.has(name);
}

/**
 * Returns all permissions as an array.
 */
export function getAllPermissions(): string[] {
    return [...PERMISSIONS];
}
