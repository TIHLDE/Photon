/**
 * Permission management for Discord-like RBAC system.
 *
 * This module handles all permission-related operations:
 * - Permission registry and type definitions
 * - Checking user permissions (global and scoped)
 * - Granting/revoking direct user permissions
 *
 * Permission format:
 * - Global: "events:create" (user can do this for ALL resources)
 * - Scoped: "events:create@group:fotball" (user can only do this for specific scope)
 */

// Registry and types
export {
    PERMISSION_REGISTRY,
    SPECIAL_PERMISSIONS,
    PERMISSIONS,
    PERMISSIONS_SET,
    isPermission,
    getAllPermissions,
    type Permission,
} from "./registry";

// Permission checking
export {
    getUserPermissions,
    getUserPermissionsWithScope,
    hasPermission,
    hasScopedPermission,
} from "./checker";

// Granting/revoking
export { grantUserPermission, revokeUserPermission } from "./grant";
