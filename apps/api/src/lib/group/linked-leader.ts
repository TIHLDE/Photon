/**
 * The two halves of a subgroup leader's org-wide permissions, kept identical.
 *
 * Hovedstyret is AU plus the leaders of the subgroups, so «leder av Beta» and
 * «Innovasjonsminister» are never two people — they are one person described
 * twice. The permission model described them twice as well:
 *
 *  - `org_group.leader_global_permissions` on the subgroup, edited from the
 *    subgroup's verv page, and
 *  - the linked HS verv (`org_group_position.linked_group_slug = 'beta'`,
 *    scope `global`), edited from HS's verv page.
 *
 * Both are read live by the permission checker, so the holder always had the
 * union of the two — but the two lists were written independently and drifted
 * badly. In production the linked verv held anything from `root`
 * (Teknologiminister) to nothing at all (Kontorminister, Næringslivsminister),
 * while every subgroup's leader list said roughly the same thing. Whichever
 * page an admin happened to open decided what they believed the leader could
 * do.
 *
 * These helpers make the two a mirror of one another: a write through either
 * page lands in both rows, and a read through either page reports the union.
 * Reporting the union is not a widening — the checker already grants it — it
 * is the two pages finally agreeing on what is already true, and it settles
 * existing drift on the next save without a data migration.
 *
 * Only the ORG-WIDE list is mirrored. `leaderPermissions` is scoped to the
 * subgroup itself (`@group:beta`) and a verv has no way to express that scope
 * — a verv with scope `group` grants within *its own* group, which for a
 * linked verv is HS. Mirroring it would silently turn rights over Beta into
 * rights over everything.
 */

import { schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * The verv that follows the leadership of `groupSlug`, in whichever group
 * holds it (normally HS). Null when the subgroup has no linked verv yet.
 */
export async function getLinkedLeaderPosition(
    ctx: AppContext,
    groupSlug: string,
) {
    const [position] = await ctx.db
        .select()
        .from(schema.groupPosition)
        .where(eq(schema.groupPosition.linkedGroupSlug, groupSlug))
        .limit(1);
    return position ?? null;
}

/** Union, order-preserving and duplicate-free. */
function union(a: string[] | null, b: string[] | null): string[] {
    return [...new Set([...(a ?? []), ...(b ?? [])])];
}

/**
 * A linked verv only mirrors while it is org-wide. A `group`-scoped verv
 * grants inside HS, which is a different claim entirely, so leave it alone
 * rather than quietly promoting it.
 */
function mirrors(position: { scope: string; linkedGroupSlug: string | null }) {
    return position.linkedGroupSlug !== null && position.scope === "global";
}

/**
 * What the linked HS verv already grants the leader of `groupSlug`. Empty
 * when the subgroup has no linked verv, or the verv no longer mirrors.
 *
 * This is also the baseline the escalation guard measures against on the
 * group's page: these permissions are already held by the very person the
 * page is about, so re-saving them hands out nothing. Only what goes beyond
 * this list is a new grant. Without that, showing the union would brick the
 * page — an admin with `roles:create` but not `root` would open Index, be
 * shown the `root` its linked verv holds, send it back untouched and be
 * refused, taking the group-scoped half they may edit down with it.
 */
export async function permissionsFromLinkedPosition(
    ctx: AppContext,
    groupSlug: string,
): Promise<string[]> {
    const position = await getLinkedLeaderPosition(ctx, groupSlug);
    if (!position || !mirrors(position)) return [];
    return position.permissions ?? [];
}

/**
 * The same baseline seen from HS's verv page: what the subgroup this verv
 * follows already grants its leader.
 */
export async function permissionsFromLinkedGroup(
    ctx: AppContext,
    position: { scope: string; linkedGroupSlug: string | null },
): Promise<string[]> {
    if (!mirrors(position) || !position.linkedGroupSlug) return [];
    const [group] = await ctx.db
        .select({ permissions: schema.group.leaderGlobalPermissions })
        .from(schema.group)
        .where(eq(schema.group.slug, position.linkedGroupSlug))
        .limit(1);
    return group?.permissions ?? [];
}

/**
 * The permissions in `next` that are genuinely new — the only ones the
 * escalation guard has anything to say about. See
 * {@link permissionsFromLinkedPosition} for why the rest are exempt.
 */
export function addedBeyond(next: string[], baseline: string[]): string[] {
    const already = new Set(baseline);
    return next.filter((p) => !already.has(p));
}

/**
 * What the subgroup's leader actually holds org-wide: the stored list plus
 * whatever the linked verv adds. Both are live grants, so this is the honest
 * answer to "what can the leader of this group do across TIHLDE".
 */
export async function readLeaderGlobalPermissions(
    ctx: AppContext,
    groupSlug: string,
    stored: string[] | null,
): Promise<string[]> {
    return union(stored, await permissionsFromLinkedPosition(ctx, groupSlug));
}

/**
 * Same, for a verv being rendered on the HS side: the verv's own list plus
 * what the subgroup it follows grants its leader.
 */
export async function readLinkedPositionPermissions(
    ctx: AppContext,
    position: {
        permissions: string[] | null;
        scope: string;
        linkedGroupSlug: string | null;
    },
): Promise<string[]> {
    return union(
        position.permissions,
        await permissionsFromLinkedGroup(ctx, position),
    );
}

/**
 * Write the subgroup half of the mirror. Called after the leader-permissions
 * route has stored the group's own list.
 */
export async function mirrorIntoLinkedPosition(
    ctx: AppContext,
    groupSlug: string,
    permissions: string[],
): Promise<void> {
    const position = await getLinkedLeaderPosition(ctx, groupSlug);
    if (!position || !mirrors(position)) return;

    await ctx.db
        .update(schema.groupPosition)
        .set({ permissions })
        .where(eq(schema.groupPosition.id, position.id));
}

/**
 * Write the HS half of the mirror. Called after a linked verv's permissions
 * have been stored, so the subgroup's leader list says the same thing.
 */
export async function mirrorIntoLinkedGroup(
    ctx: AppContext,
    position: { scope: string; linkedGroupSlug: string | null },
    permissions: string[],
): Promise<void> {
    if (!mirrors(position) || !position.linkedGroupSlug) return;

    await ctx.db
        .update(schema.group)
        .set({ leaderGlobalPermissions: permissions })
        .where(eq(schema.group.slug, position.linkedGroupSlug));
}

/**
 * {@link readLinkedPositionPermissions} for a whole verv list, in one query.
 *
 * The group listing renders every verv at once and only a handful are linked,
 * so this looks up the linked groups together rather than once per row.
 * Returns the permissions to display, keyed by position id.
 */
export async function readLinkedPositionPermissionsBatch(
    ctx: AppContext,
    positions: Array<{
        id: string;
        permissions: string[] | null;
        scope: string;
        linkedGroupSlug: string | null;
    }>,
): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>(
        positions.map((p) => [p.id, p.permissions ?? []]),
    );

    const linked = positions.filter(mirrors);
    if (linked.length === 0) return result;

    const slugs = [...new Set(linked.map((p) => p.linkedGroupSlug as string))];
    const groups = await ctx.db
        .select({
            slug: schema.group.slug,
            permissions: schema.group.leaderGlobalPermissions,
        })
        .from(schema.group)
        .where(inArray(schema.group.slug, slugs));

    const bySlug = new Map(groups.map((g) => [g.slug, g.permissions]));
    for (const position of linked) {
        result.set(
            position.id,
            union(
                position.permissions,
                bySlug.get(position.linkedGroupSlug as string) ?? [],
            ),
        );
    }

    return result;
}
