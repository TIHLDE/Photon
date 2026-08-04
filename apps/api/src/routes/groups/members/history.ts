import { schema } from "@photon/db";
import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { formerMemberListSchema } from "../schema";

export const listFormerMembersRoute = route().get(
    "/:groupSlug/members/history",
    describeRoute({
        tags: ["groups"],
        summary: "List former group members",
        operationId: "listGroupFormerMembers",
        description:
            "Retrieve the group's ended memberships — the people who used to be members. Anyone currently in the group is excluded, and a member with several stints is listed once, by their most recent one.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: formerMemberListSchema,
            description: "List of former members retrieved successfully",
        })
        .notFound({ description: "Group not found" })
        .forbidden({
            description: "The group is private and you are not a member",
        })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");

        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        await assertGroupVisible(ctx, group, c.get("user")?.id);

        const entries = await db.query.groupMembershipHistory.findMany({
            where: eq(schema.groupMembershipHistory.groupSlug, groupSlug),
            orderBy: [desc(schema.groupMembershipHistory.endedAt)],
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        /**
         * Someone who rejoined is a current member, not a former one, and the
         * backfilled Lepton history also holds role-change rows for people who
         * never left. Both are dropped by excluding the current roster.
         */
        const current = await db
            .select({ userId: schema.groupMembership.userId })
            .from(schema.groupMembership)
            .where(eq(schema.groupMembership.groupSlug, groupSlug));
        const currentIds = new Set(current.map((m) => m.userId));

        // Entries come back newest-first, so the first one seen per user is
        // their most recent stint — earlier stints are folded away.
        const seen = new Set<string>();
        const formerMembers = entries.filter((entry) => {
            if (currentIds.has(entry.userId) || seen.has(entry.userId)) {
                return false;
            }
            seen.add(entry.userId);
            return true;
        });

        return c.json(
            formerMembers.map((entry) => ({
                id: entry.id,
                userId: entry.userId,
                groupSlug: entry.groupSlug,
                role: entry.role,
                startedAt: entry.startedAt.toISOString(),
                endedAt: entry.endedAt.toISOString(),
                user: entry.user,
            })),
        );
    },
);
