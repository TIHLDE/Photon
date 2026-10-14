import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { inArray } from "drizzle-orm";
import type z from "zod";
import type { AppContext } from "~/lib/ctx";
import type { feedbackAuthorSchema } from "./schema";

type FeedbackAuthor = z.infer<typeof feedbackAuthorSchema>;

/**
 * Only moderators may see who filed a piece of feedback. Every response that
 * includes `author` must be gated on this, since the frontend can hide a name
 * but not stop it from being read in the network tab.
 */
export function canSeeFeedbackAuthor(
    ctx: Parameters<typeof hasPermission>[0],
    userId: string,
): Promise<boolean> {
    return hasPermission(ctx, userId, ["feedback:update", "feedback:manage"]);
}

/** Looks up the given authors in one query, keyed by user id. */
export async function getFeedbackAuthors(
    db: AppContext["db"],
    authorIds: (string | null)[],
): Promise<Map<string, FeedbackAuthor>> {
    const ids = [...new Set(authorIds.filter((id) => id !== null))];

    if (ids.length === 0) {
        return new Map();
    }

    const authors = await db
        .select({
            id: schema.user.id,
            name: schema.user.name,
        })
        .from(schema.user)
        .where(inArray(schema.user.id, ids));

    return new Map(authors.map((author) => [author.id, author]));
}
