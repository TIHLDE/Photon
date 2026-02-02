/**
 * Shared types for the Photon SDK.
 *
 * These types mirror the backend's session and permission structures.
 */

/**
 * User data from the session.
 */
export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
    username: string | null;
    displayUsername: string | null;
}

/**
 * Session metadata.
 */
export interface Session {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string;
    impersonatedBy: string | null;
}

/**
 * Group membership role type.
 */
export type GroupMembershipRole = "member" | "leader";

/**
 * A user's group membership information.
 */
export interface GroupMembership {
    slug: string;
    role: GroupMembershipRole;
}

/**
 * Permission string type.
 *
 * Format: "domain:action" or "domain:subdomain:action"
 * Examples: "events:create", "events:registrations:view", "root"
 */
export type Permission = string;

/**
 * Extended session data with permissions and groups.
 *
 * This is the full session object returned when fetching the current session
 * with extended data enabled.
 */
export interface ExtendedSession {
    session: Session;
    user: User;
    permissions: Permission[];
    groups: GroupMembership[];
}

/**
 * Basic session data without permissions and groups.
 */
export interface BasicSession {
    session: Session;
    user: User;
}
