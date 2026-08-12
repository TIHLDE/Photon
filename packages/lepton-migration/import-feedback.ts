/**
 * Import the tilbakemeldinger (idéer og feilmeldinger) from Lepton.
 *
 * Standalone rather than a phase of the main migration, for the same reason
 * import-toddel.ts is: this ran long after the big migration was done, and the
 * sources it needs are not the ones the phases share.
 *
 * Two sources, in order of preference:
 *
 * 1. Lepton's own REST API (`/feedbacks/`), when LEPTON_TOKEN is set. This is
 *    live and complete, and carries the per-user reactions along with each
 *    entry. The endpoint is member-gated, so it needs a token from a TIHLDE
 *    account — read from the environment, never from the command line, so it
 *    stays out of shell history.
 * 2. The MySQL dump under `dumps/`, plus `data/tables/emoji_reaction.json` for
 *    the votes. Lepton's superuser-gated table-export endpoint — the source
 *    `src/mysql.ts` serves from — never listed the feedback tables and has
 *    since been removed, so this is the only offline copy.
 *
 * The dump is the fallback and not the source, for two reasons. It stops at
 * Lepton id 65 (September 2025), so it is missing the 21 entries filed after
 * that. And it still holds the 24 that have been deleted since — importing
 * from it would put those back in front of everyone. The token path was the
 * one actually used: 33 feedback and 25 votes, exactly what the page showed.
 * Running without a token imports the older set and says what it dropped.
 *
 * Photon ids are derived from the Lepton id (UUIDv5 over a fixed namespace)
 * rather than random, so re-running imports nothing twice — including a run
 * from the dump followed later by a run from the API, which fills in the rest
 * without duplicating what is already here.
 *
 *   DATABASE_URL=... LEPTON_TOKEN=$(cat .lepton-token) \
 *       bun packages/lepton-migration/import-feedback.ts
 *   ... --commit    to actually write
 */
import { createHash } from "node:crypto";
import { schema } from "@photon/db";
import { drizzle } from "drizzle-orm/node-postgres";

const commit = process.argv.includes("--commit");
const dumpPath = process.env.LEPTON_DUMP ?? `${import.meta.dir}/dumps/dump.sql`;
const reactionsPath =
    process.env.LEPTON_REACTIONS ??
    `${import.meta.dir}/data/tables/emoji_reaction.json`;

/** Lepton's `feedback.Status` choices, lowercased to Photon's enum. */
const STATUS_MAP: Record<
    string,
    "open" | "in_progress" | "closed" | "rejected"
> = {
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    CLOSED: "closed",
    REJECTED: "rejected",
};

/**
 * A fixed namespace, so the id a feedback gets here is the id it gets on every
 * later run and in every environment. Any random UUID would do as the
 * namespace; this one is arbitrary and must never change.
 */
const NAMESPACE = "6f1d0a2c-1f3b-4a63-9d1a-2b8f0c5e7a41";

/** RFC 4122 §4.3 name-based UUID (v5, SHA-1) over the namespace above. */
function uuidV5(name: string): string {
    const hex = NAMESPACE.replace(/-/g, "");
    const namespaceBytes = Buffer.from(hex, "hex");
    const hash = createHash("sha1")
        .update(Buffer.concat([namespaceBytes, Buffer.from(name, "utf8")]))
        .digest();

    const bytes = Buffer.from(hash.subarray(0, 16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

    const out = bytes.toString("hex");
    return [
        out.slice(0, 8),
        out.slice(8, 12),
        out.slice(12, 16),
        out.slice(16, 20),
        out.slice(20),
    ].join("-");
}

type SqlValue = string | number | null;

/**
 * Read the tuples out of one `INSERT INTO <table> VALUES (...),(...);` line.
 *
 * mysqldump writes one long line per table, with backslash escapes inside
 * quoted strings — several of these feedback descriptions contain both
 * escaped quotes and newlines, so splitting on `),(` would tear them apart.
 * This walks the line instead, tracking whether it is inside a string.
 */
function parseInsert(sql: string, table: string): SqlValue[][] {
    const marker = `INSERT INTO \`${table}\` VALUES `;
    const rows: SqlValue[][] = [];

    let searchFrom = 0;
    for (;;) {
        const start = sql.indexOf(marker, searchFrom);
        if (start === -1) break;

        let i = start + marker.length;
        let current: SqlValue[] = [];
        let token = "";
        let inString = false;
        let inTuple = false;

        for (; i < sql.length; i++) {
            const ch = sql[i]!;

            if (inString) {
                if (ch === "\\") {
                    const next = sql[i + 1]!;
                    // mysqldump's escapes: the ones that mean something other
                    // than the literal character following the backslash.
                    token +=
                        next === "n"
                            ? "\n"
                            : next === "r"
                              ? "\r"
                              : next === "t"
                                ? "\t"
                                : next === "0"
                                  ? "\0"
                                  : next;
                    i++;
                } else if (ch === "'") {
                    inString = false;
                    current.push(token);
                    token = "";
                } else {
                    token += ch;
                }
                continue;
            }

            if (ch === "(") {
                inTuple = true;
                token = "";
                continue;
            }
            if (ch === "'") {
                inString = true;
                token = "";
                continue;
            }
            if (ch === "," || ch === ")") {
                const raw = token.trim();
                if (raw.length > 0) {
                    current.push(raw === "NULL" ? null : Number(raw));
                }
                token = "";
                if (ch === ")") {
                    rows.push(current);
                    current = [];
                    inTuple = false;
                }
                continue;
            }
            if (ch === ";" && !inTuple) break;

            token += ch;
        }

        searchFrom = i;
    }

    return rows;
}

type SourceFeedback = {
    leptonId: number;
    type: "idea" | "bug";
    status: "open" | "in_progress" | "closed" | "rejected";
    title: string;
    description: string;
    authorUsername: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type SourceVote = {
    leptonFeedbackId: number;
    username: string;
    value: "up" | "down";
    createdAt: Date;
};

const EMOJI_TO_VOTE: Record<string, "up" | "down"> = {
    ":thumbs-up:": "up",
    ":thumbs-down:": "down",
};

/** Django wrote naive UTC datetimes, in both the dump and the API. */
function parseUtc(value: string): Date {
    const iso = value.replace(" ", "T");
    return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

function toStatus(raw: string, leptonId: number) {
    const status = STATUS_MAP[raw];
    if (!status) {
        throw new Error(`Feedback ${leptonId} has unknown status "${raw}"`);
    }
    return status;
}

// --- Source 1: Lepton's REST API ------------------------------------------

type LeptonApiFeedback = {
    id: number;
    feedback_type: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    updated_at?: string;
    author: { user_id: string } | string | null;
    reactions?: Array<{
        emoji: string;
        user: { user_id: string } | null;
        created_at?: string;
    }>;
};

async function loadFromApi(
    token: string,
): Promise<{ feedback: SourceFeedback[]; votes: SourceVote[] }> {
    const base = process.env.LEPTON_API ?? "https://api.tihlde.org";
    const feedback: SourceFeedback[] = [];
    const votes: SourceVote[] = [];

    let page = 1;
    for (;;) {
        const res = await fetch(`${base}/feedbacks/?page=${page}`, {
            headers: {
                "X-Csrf-Token": token,
                "User-Agent": "photon-feedback-import/1.0 (TIHLDE)",
            },
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(
                `Lepton answered ${res.status} for /feedbacks/?page=${page}: ${body.slice(0, 200)}`,
            );
        }

        const payload = (await res.json()) as {
            next: number | string | null;
            results: LeptonApiFeedback[];
        };

        for (const item of payload.results) {
            const type =
                item.feedback_type.toLowerCase() === "bug" ? "bug" : "idea";
            const author =
                typeof item.author === "string"
                    ? item.author
                    : (item.author?.user_id ?? null);

            feedback.push({
                leptonId: item.id,
                type,
                status: toStatus(item.status, item.id),
                title: item.title,
                description: item.description,
                authorUsername: author,
                createdAt: parseUtc(item.created_at),
                updatedAt: parseUtc(item.updated_at ?? item.created_at),
            });

            for (const reaction of item.reactions ?? []) {
                const value = EMOJI_TO_VOTE[reaction.emoji];
                if (!value || !reaction.user) continue;

                votes.push({
                    leptonFeedbackId: item.id,
                    username: reaction.user.user_id,
                    value,
                    createdAt: reaction.created_at
                        ? parseUtc(reaction.created_at)
                        : parseUtc(item.created_at),
                });
            }
        }

        if (payload.next == null) break;
        page++;
    }

    return { feedback, votes };
}

// --- Source 2: the MySQL dump plus the reaction export --------------------

type LeptonReaction = {
    emoji: string;
    object_id: number | null;
    content_type_id: number | null;
    user_id: string;
    created_at: string;
};

/**
 * `django_content_type` ids for `feedback.feedback`, `.bug` and `.idea`.
 * Hardcoded rather than looked up: the content type table is not in the dump,
 * and these are the values the July 2026 export carried.
 */
const FEEDBACK_CONTENT_TYPE_IDS = new Set([58, 59, 60]);

async function loadFromDump(): Promise<{
    feedback: SourceFeedback[];
    votes: SourceVote[];
}> {
    const dump = await Bun.file(dumpPath).text();

    // feedback_feedback: (id, created_at, updated_at, title, description,
    // status, author_id, polymorphic_ctype_id)
    const feedbackRows = parseInsert(dump, "feedback_feedback");
    // feedback_bug / feedback_idea: (feedback_ptr_id, ...) — the discriminator.
    const bugIds = new Set(
        parseInsert(dump, "feedback_bug").map((r) => Number(r[0])),
    );
    const ideaIds = new Set(
        parseInsert(dump, "feedback_idea").map((r) => Number(r[0])),
    );

    if (feedbackRows.length === 0) {
        throw new Error(
            `No feedback rows found in ${dumpPath}; refusing to run`,
        );
    }

    const feedback: SourceFeedback[] = [];
    const untyped: number[] = [];

    for (const row of feedbackRows) {
        const leptonId = Number(row[0]);
        const type = bugIds.has(leptonId)
            ? ("bug" as const)
            : ideaIds.has(leptonId)
              ? ("idea" as const)
              : null;

        if (!type) {
            // A base row with no subclass row: Django would never write one,
            // so this means the dump is inconsistent rather than that a third
            // type exists. Reported instead of guessed at.
            untyped.push(leptonId);
            continue;
        }

        feedback.push({
            leptonId,
            type,
            status: toStatus(String(row[5]), leptonId),
            title: String(row[3]),
            description: String(row[4]),
            authorUsername: row[6] === null ? null : String(row[6]),
            createdAt: parseUtc(String(row[1])),
            updatedAt: parseUtc(String(row[2])),
        });
    }

    if (untyped.length > 0) {
        console.warn(
            `  ${untyped.length} feedback rows are neither bug nor idea, skipped: ${untyped.join(", ")}`,
        );
    }

    const reactionsFile = Bun.file(reactionsPath);
    const reactions: LeptonReaction[] = (await reactionsFile.exists())
        ? await reactionsFile.json()
        : [];

    if (reactions.length === 0) {
        console.warn(
            `  No reactions found at ${reactionsPath} — importing feedback without votes`,
        );
    }

    const known = new Set(feedback.map((f) => f.leptonId));
    const orphaned = new Set<number>();

    const votes = reactions.flatMap((r) => {
        if (
            !r.content_type_id ||
            !FEEDBACK_CONTENT_TYPE_IDS.has(r.content_type_id)
        )
            return [];
        if (!r.object_id) return [];

        // A vote on feedback the dump never saw. Counted so the run can say
        // how much newer the export is than the dump, instead of quietly
        // dropping it.
        if (!known.has(r.object_id)) {
            orphaned.add(r.object_id);
            return [];
        }

        const value = EMOJI_TO_VOTE[r.emoji];
        if (!value) return [];

        return [
            {
                leptonFeedbackId: r.object_id,
                username: r.user_id,
                value,
                createdAt: parseUtc(r.created_at),
            },
        ];
    });

    if (orphaned.size > 0) {
        console.warn(
            `  ${orphaned.size} feedback have votes but are missing from the dump ` +
                `(Lepton ids ${[...orphaned].sort((a, b) => a - b).join(", ")}). ` +
                `Set LEPTON_TOKEN to import them from Lepton's API instead.`,
        );
    }

    return { feedback, votes };
}

const token = process.env.LEPTON_TOKEN;

const { feedback: source, votes } = token
    ? await loadFromApi(token)
    : await loadFromDump();

console.log(
    `Found ${source.length} feedback ${token ? "in Lepton's API" : "in the dump"} ` +
        `(${source.filter((f) => f.type === "bug").length} bugs, ${source.filter((f) => f.type === "idea").length} ideas) ` +
        `and ${votes.length} votes`,
);

// --- Write ----------------------------------------------------------------

const db = drizzle(process.env.DATABASE_URL!, { schema });

/**
 * Lepton's user_id (`brotherman`) is kept as Photon's `username`, which is how
 * the user phase adopted the accounts. An author with no Photon account is
 * imported as authorless rather than dropped — the report is still worth
 * having, and the column is nullable for exactly this.
 */
const users = await db.query.user.findMany({
    columns: { id: true, username: true },
});
const userIdByUsername = new Map(
    users.flatMap((u) => (u.username ? [[u.username, u.id] as const] : [])),
);

const missingAuthors = new Set<string>();

const feedbackValues = source.map((f) => {
    const authorId = f.authorUsername
        ? (userIdByUsername.get(f.authorUsername) ?? null)
        : null;
    if (f.authorUsername && !authorId) missingAuthors.add(f.authorUsername);

    return {
        id: uuidV5(`feedback:${f.leptonId}`),
        type: f.type,
        status: f.status,
        title: f.title.slice(0, 100),
        description: f.description,
        authorId,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
    };
});

const missingVoters = new Set<string>();

const voteValues = votes.flatMap((v) => {
    const userId = userIdByUsername.get(v.username);
    if (!userId) {
        missingVoters.add(v.username);
        return [];
    }

    return [
        {
            feedbackId: uuidV5(`feedback:${v.leptonFeedbackId}`),
            userId,
            value: v.value,
            createdAt: v.createdAt,
        },
    ];
});

if (missingAuthors.size > 0) {
    console.warn(
        `  ${missingAuthors.size} authors have no Photon account, imported as authorless: ${[...missingAuthors].join(", ")}`,
    );
}
if (missingVoters.size > 0) {
    console.warn(
        `  ${missingVoters.size} voters have no Photon account, votes dropped: ${[...missingVoters].join(", ")}`,
    );
}

if (!commit) {
    console.log(
        `\nDry run: would insert ${feedbackValues.length} feedback and ${voteValues.length} votes.`,
    );
    console.log("Run again with --commit to write.");
    process.exit(0);
}

await db
    .insert(schema.feedback)
    .values(feedbackValues)
    .onConflictDoNothing({ target: schema.feedback.id });

if (voteValues.length > 0) {
    await db
        .insert(schema.feedbackVote)
        .values(voteValues)
        .onConflictDoNothing();
}

const total = await db.$count(schema.feedback);
const totalVotes = await db.$count(schema.feedbackVote);

console.log(
    `\nDone. Photon now holds ${total} feedback and ${totalVotes} votes.`,
);

process.exit(0);
