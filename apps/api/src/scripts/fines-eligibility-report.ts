/**
 * Who in a group may use bøter today, and what is missing for the rest.
 *
 * Read-only. Nothing here writes, so it is safe to point at production.
 *
 * ### Why this exists rather than a backfill
 *
 * Bøter in a study group are gated on `studyProgramMembership.feideActive` —
 * see `isFinesEligibleMember` — and that flag can only be written by the
 * member's own Feide login. Dataporten's discovery document lists no
 * `refresh_token` grant, and Photon does not request `offline_access`, so the
 * access token stored on a Feide account is short-lived and cannot be renewed.
 * `groups-api.dataporten.no/groups/me/groups` answers for the token's owner
 * and nobody else, and `client_credentials` buys an app token that cannot ask
 * on a member's behalf. There is therefore no credential with which a batch
 * job could fill the flag in for 128 people.
 *
 * What is left is telling the group who has to log in. That is what this
 * prints: the members who already qualify, the ones a single Feide sign-in
 * would fix, and the ones who have no Feide account linked at all and must
 * link one first.
 *
 * ### Usage
 *
 *     bun run src/scripts/fines-eligibility-report.ts <group-slug>
 *     bun run src/scripts/fines-eligibility-report.ts digital-samhandling --emails
 *
 * `--emails` adds a comma-separated address list per bucket, for sending the
 * nudge. Left off by default so an ordinary run does not spill 128 addresses
 * into a terminal that may be shared on a screen.
 */

import { env } from "@photon/core/env";
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { and, asc, eq } from "drizzle-orm";

/**
 * Its own connection, with the request timeouts off: this walks every member
 * of a group one at a time and would otherwise trip the statement timeout the
 * API runs with.
 */
const db = createDb({
    connectionString: env.DATABASE_URL,
    timeouts: DISABLED_TIMEOUTS,
});

const FEIDE_PROVIDER_ID = "feide";

type Row = {
    userId: string;
    name: string;
    username: string | null;
    email: string;
    feideActive: boolean | null;
    feideCheckedAt: Date | null;
    hasFeideAccount: boolean;
};

async function main() {
    const [slug, ...flags] = process.argv.slice(2);
    const showEmails = flags.includes("--emails");

    if (!slug) {
        console.error(
            "Usage: bun run src/scripts/fines-eligibility-report.ts <group-slug> [--emails]",
        );
        process.exit(1);
    }

    const group = await db.query.group.findFirst({
        where: (g, { eq: is }) => is(g.slug, slug),
    });

    if (!group) {
        console.error(`No group with slug "${slug}".`);
        process.exit(1);
    }

    const isStudyGroup = group.type.toLowerCase() === "study";

    /**
     * The programme a study group projects, found by the slug the two share.
     * Its absence is worth saying out loud: without it every member fails the
     * check, and the cause is a missing `study_program` row rather than
     * anything about the members.
     */
    const program = isStudyGroup
        ? await db.query.studyProgram.findFirst({
              where: (p, { eq: is }) => is(p.slug, slug),
          })
        : null;

    if (isStudyGroup && !program) {
        console.error(
            `Group "${slug}" is a STUDY group but no study_program has that slug — nobody can pass the fines check until one does.`,
        );
        process.exit(1);
    }

    const members = await db
        .select({
            userId: schema.groupMembership.userId,
            name: schema.user.name,
            username: schema.user.username,
            email: schema.user.email,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.user,
            eq(schema.user.id, schema.groupMembership.userId),
        )
        .where(eq(schema.groupMembership.groupSlug, slug))
        .orderBy(asc(schema.user.name));

    const rows: Row[] = [];

    for (const member of members) {
        const [enrolment] = program
            ? await db
                  .select({
                      feideActive: schema.studyProgramMembership.feideActive,
                      feideCheckedAt:
                          schema.studyProgramMembership.feideCheckedAt,
                  })
                  .from(schema.studyProgramMembership)
                  .where(
                      and(
                          eq(
                              schema.studyProgramMembership.userId,
                              member.userId,
                          ),
                          eq(
                              schema.studyProgramMembership.studyProgramId,
                              program.id,
                          ),
                      ),
                  )
                  .limit(1)
            : [];

        const [feideAccount] = await db
            .select({ id: schema.account.id })
            .from(schema.account)
            .where(
                and(
                    eq(schema.account.userId, member.userId),
                    eq(schema.account.providerId, FEIDE_PROVIDER_ID),
                ),
            )
            .limit(1);

        rows.push({
            ...member,
            feideActive: enrolment?.feideActive ?? null,
            feideCheckedAt: enrolment?.feideCheckedAt ?? null,
            hasFeideAccount: Boolean(feideAccount),
        });
    }

    const eligible = rows.filter((r) => r.feideActive === true);
    /**
     * Feide has answered, and the answer was "not enrolled". A login will not
     * change this — only actually being a student again would.
     */
    const lapsed = rows.filter((r) => r.feideActive === false);
    /**
     * We have never had an answer. One Feide sign-in settles it either way,
     * which makes this the only bucket worth nudging.
     */
    const unknown = rows.filter((r) => r.feideActive === null);
    const unknownWithFeide = unknown.filter((r) => r.hasFeideAccount);
    const unknownWithoutFeide = unknown.filter((r) => !r.hasFeideAccount);

    const list = (label: string, group_: Row[]) => {
        console.log(`\n${label} (${group_.length})`);
        for (const r of group_) {
            const checked = r.feideCheckedAt
                ? ` sist sjekket ${r.feideCheckedAt.toISOString().slice(0, 10)}`
                : "";
            console.log(
                `  ${r.name} (${r.username ?? "uten brukernavn"})${checked}`,
            );
        }
        if (showEmails && group_.length > 0) {
            console.log(`  → ${group_.map((r) => r.email).join(", ")}`);
        }
    };

    console.log(`\n${group.name} (${group.slug}) — type ${group.type}`);
    console.log(`Botsystem: ${group.finesActivated ? "på" : "AV"}`);
    console.log(`Botsjef: ${group.finesAdminId ?? "ingen satt"}`);
    console.log(`Medlemmer: ${rows.length}`);

    if (!isStudyGroup) {
        console.log(
            "\nIkke en studiegruppe — medlemskap er hele regelen her, så alle medlemmene kan gi og lese bøter.",
        );
        return;
    }

    list("Har tilgang nå — Feide bekrefter aktivt studium", eligible);
    list(
        "Én Feide-innlogging unna — konto koblet, aldri synket",
        unknownWithFeide,
    );
    list(
        "Må koble Feide først — ingen Feide-konto på brukeren",
        unknownWithoutFeide,
    );
    list("Feide sier ikke lenger student — alumni", lapsed);

    console.log(
        `\nOppsummert: ${eligible.length} har tilgang, ${unknownWithFeide.length + unknownWithoutFeide.length} kan få den ved å logge inn med Feide, ${lapsed.length} er alumni.`,
    );

    if (!group.finesAdminId) {
        console.log(
            "\nNB: ingen botsjef er satt, så ingen kan godkjenne, avvise eller markere bøter som betalt.",
        );
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
