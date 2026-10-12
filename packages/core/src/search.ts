export function getSearchTerms(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Match every word, allowing omitted middle names and any word order. */
export function matchesSearch(
    fields: (string | null | undefined)[],
    query: string,
): boolean {
    const text = fields.join(" ").toLowerCase();
    return getSearchTerms(query).every((term) => text.includes(term));
}
