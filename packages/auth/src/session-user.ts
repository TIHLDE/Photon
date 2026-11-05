import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbRelations } from "@photon/db";
import { isFeideCheckCurrent } from "./feide";

/**
 * The fields Photon adds to the session user, read live from the database.
 *
 * Shared by `customSession` (cookie sessions) and the API's bearer-token path,
 * so both hand routes the same user. Read here rather than taken from the
 * session Better Auth caches, because approval and settings change through
 * our own queries, which that cache never sees.
 */
export async function sessionUserFields(
    db: NodePgDatabase<DbRelations>,
    userId: string,
) {
    const [row, accounts] = await Promise.all([
        db.query.user.findFirst({
            where: { id: userId },
            columns: { approvalStatus: true },
            with: {
                settings: {
                    with: { allergies: { columns: { allergySlug: true } } },
                },
                studyProgramMemberships: { columns: { feideCheckedAt: true } },
            },
        }),
        db.query.account.findMany({
            where: { userId },
            columns: { providerId: true, passwordSource: true },
        }),
    ]);

    const settings = row?.settings;
    const credential = accounts.find((a) => a.providerId === "credential");
    const programmes = row?.studyProgramMemberships ?? [];
    const feideCheckedAt = programmes
        .map((m) => m.feideCheckedAt)
        .filter((at): at is Date => at != null)
        .reduce<Date | null>(
            (newest, at) => (newest === null || at > newest ? at : newest),
            null,
        );

    return {
        approvalStatus: row?.approvalStatus ?? null,
        isPendingApproval: row?.approvalStatus === "pending",
        /**
         * `none`: never had a password. `placeholder`: the one the Lepton
         * migration set, which nobody knows. `chosen`: needs nothing.
         */
        passwordState: !credential
            ? ("none" as const)
            : credential.passwordSource === "migrated"
              ? ("placeholder" as const)
              : ("chosen" as const),
        settings: settings
            ? {
                  ...settings,
                  allergies: settings.allergies.map((a) => a.allergySlug),
              }
            : null,
        feideCheckedAt: feideCheckedAt?.toISOString() ?? null,
        // Without a Feide account there is nothing to refresh, and without a
        // programme row a new login would give the same empty answer.
        needsFeideRefresh:
            accounts.some((a) => a.providerId === "feide") &&
            programmes.length > 0 &&
            !isFeideCheckCurrent(feideCheckedAt),
    };
}
