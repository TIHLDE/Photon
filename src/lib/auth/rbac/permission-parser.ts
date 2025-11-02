/**
 * Permission parsing utilities for handling scoped permissions.
 *
 * Permission format:
 * - Global: "events:create"
 * - Scoped: "events:create@group:fotball"
 *
 * This allows both roles and user permissions to have scopes.
 */

/**
 * Parsed permission with optional scope.
 */
export type ParsedPermission = {
	permission: string;
	scope: string | null;
};

/**
 * Parse a permission string into permission + optional scope.
 *
 * @example
 * parsePermission("events:create") → { permission: "events:create", scope: null }
 * parsePermission("events:create@group:fotball") → { permission: "events:create", scope: "group:fotball" }
 */
export function parsePermission(raw: string): ParsedPermission {
	const parts = raw.split("@");

	if (parts.length === 1) {
		// No scope: "events:create"
		const perm = parts[0];
		if (!perm) {
			throw new Error(`Invalid permission format: empty string`);
		}
		return { permission: perm.trim(), scope: null };
	}

	if (parts.length === 2) {
		// Has scope: "events:create@group:fotball"
		const perm = parts[0];
		const scopePart = parts[1];
		if (!perm || !scopePart) {
			throw new Error(
				`Invalid permission format: "${raw}". Both permission and scope must be non-empty`,
			);
		}
		return {
			permission: perm.trim(),
			scope: scopePart.trim(),
		};
	}

	// Invalid format (multiple @)
	throw new Error(
		`Invalid permission format: "${raw}". Expected "permission" or "permission@scope"`,
	);
}

/**
 * Parse an array of permission strings.
 */
export function parsePermissions(raw: string[]): ParsedPermission[] {
	return raw.map(parsePermission);
}

/**
 * Format a permission back to string format.
 *
 * @example
 * formatPermission("events:create", null) → "events:create"
 * formatPermission("events:create", "group:fotball") → "events:create@group:fotball"
 */
export function formatPermission(
	permission: string,
	scope: string | null,
): string {
	return scope ? `${permission}@${scope}` : permission;
}

/**
 * Check if a permission string has a scope.
 */
export function hasScope(raw: string): boolean {
	return raw.includes("@");
}

/**
 * Extract just the permission name (without scope).
 *
 * @example
 * getPermissionName("events:create@group:fotball") → "events:create"
 * getPermissionName("events:create") → "events:create"
 */
export function getPermissionName(raw: string): string {
	return parsePermission(raw).permission;
}

/**
 * Extract just the scope (if any).
 *
 * @example
 * getPermissionScope("events:create@group:fotball") → "group:fotball"
 * getPermissionScope("events:create") → null
 */
export function getPermissionScope(raw: string): string | null {
	return parsePermission(raw).scope;
}

/**
 * Check if a permission matches a required permission, considering scopes.
 *
 * Rules:
 * - Global permission matches any scope request
 * - Scoped permission only matches exact scope
 *
 * @param grantedRaw - Permission the user has (from role or direct grant)
 * @param requiredPermission - Permission name required (e.g., "events:create")
 * @param requiredScope - Scope required (e.g., "group:fotball")
 *
 * @example
 * // User has global permission
 * matchesPermission("events:create", "events:create", "group:fotball") → true
 *
 * @example
 * // User has scoped permission (exact match)
 * matchesPermission("events:create@group:fotball", "events:create", "group:fotball") → true
 *
 * @example
 * // User has scoped permission (wrong scope)
 * matchesPermission("events:create@group:index", "events:create", "group:fotball") → false
 */
export function matchesPermission(
	grantedRaw: string,
	requiredPermission: string,
	requiredScope: string | null,
): boolean {
	const granted = parsePermission(grantedRaw);

	// Permission name must match
	if (granted.permission !== requiredPermission) {
		return false;
	}

	// If granted permission is global (no scope), it matches any required scope
	if (granted.scope === null) {
		return true;
	}

	// If granted permission is scoped, it must match the required scope exactly
	return granted.scope === requiredScope;
}
