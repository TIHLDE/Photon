/**
 * Role management for Discord-like RBAC system.
 *
 * This module handles all role-related operations:
 * - Role CRUD (create, read, update, delete)
 * - User-role assignments
 * - Role hierarchy (position-based, Discord-like)
 * - Role permission management
 *
 * Role Hierarchy:
 * - Higher position number = higher in hierarchy (better role)
 * - Users can only manage users/roles with LOWER position numbers (strictly less than)
 * - Users cannot modify their own highest role
 */

// Role queries
export { getRoleByName, getRoleById, getAllRoles } from "./queries";

// User-role operations
export {
    getUserRoles,
    userHasRole,
    userHasAnyRole,
    assignUserRole,
    removeUserRole,
    getRoleUserIds,
} from "./user-roles";

// Hierarchy
export { getUserHighestRolePosition, userCanManageUser } from "./hierarchy";

// Role permission management
export { assignRolePermissions, setRolePermissions } from "./role-permissions";

// Role CRUD
export {
    createRole,
    createTestingRole,
    deleteRole,
    reorderRole,
} from "./crud";
