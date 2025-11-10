import { and, eq } from "drizzle-orm";
import { schema } from "~/db";
import type { AppContext } from "~/lib/ctx";
import { getUserPermissions } from "./roles";

/**
 * Check if a user has a specific permission for a specific resource (scoped permission).
 * This checks both global permissions and scoped permissions.
 *
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * // Check if user can update a specific news article
 * if (await hasPermissionForResource(ctx, userId, 'news:update', 'news-123')) {
 *     // User can update news article with ID 123
 * }
 *
 * @example
 * // Check if user can create events for a specific group
 * if (await hasPermissionForResource(ctx, userId, 'events:create', 'group:fotball')) {
 *     // User can create events for the fotball group
 * }
 */
export async function hasPermissionForResource(
    ctx: AppContext,
    userId: string,
    permissionName: string,
    resourceScope: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(ctx, userId);

    // Root permission grants everything
    if (permissions.includes("root")) return true;

    // Check if user has the permission globally
    if (permissions.includes(permissionName)) return true;

    // Check for scoped permission in userPermission table
    const scopedPermission = await ctx.db.query.userPermission.findFirst({
        where: and(
            eq(schema.userPermission.userId, userId),
            eq(schema.userPermission.permission, permissionName),
            eq(schema.userPermission.scope, resourceScope),
        ),
    });

    return !!scopedPermission;
}
