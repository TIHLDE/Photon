/**
 * The paragraph a fine cites, in the same shape the lovverk endpoints use.
 *
 * `GET /groups/:slug/laws` selects the column directly and returns Postgres'
 * own text for `numeric(4,2)` — "3.10". A fine reaches its paragraph through a
 * relation, and Drizzle builds those with JSON aggregation, which normalises
 * the number and drops the trailing zero — "3.1". Same paragraph, two spellings
 * of it, depending on which endpoint you asked. Formatting here keeps the API
 * consistent instead of leaving every consumer to guess.
 */
export function serializeFineLaw<
    T extends { law: { paragraph: string } | null },
>(fine: T): T {
    if (!fine.law) return fine;
    return {
        ...fine,
        law: { ...fine.law, paragraph: Number(fine.law.paragraph).toFixed(2) },
    };
}
