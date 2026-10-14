import { getSearchTerms } from "@photon/core/search";
import { schema } from "@photon/db";
import { and, ilike, or } from "drizzle-orm";

export function userSearchFilter(query: string = "") {
    return and(
        ...getSearchTerms(query).map((term) => {
            // Search text is literal, not a SQL LIKE pattern.
            const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
            return or(
                ilike(schema.user.name, pattern),
                ilike(schema.user.username, pattern),
            );
        }),
    );
}
