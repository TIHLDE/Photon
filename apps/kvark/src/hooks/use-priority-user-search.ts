import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { searchUsersQuery } from "#/api/queries/roles";
import type { UserSearchState } from "#/components/priority-pool-editor";
import { useDebounced } from "#/lib/use-debounced";

/**
 * Søket etter enkeltpersoner som skal prioriteres på et arrangement.
 *
 * Ligger her og ikke i editoren fordi komponentene i `components/` ikke
 * henter data selv, og begge adminsidene for arrangementer trenger nøyaktig
 * det samme søket.
 *
 * Søket treffer hele brukerregisteret — den prioriterte er ofte en utenfor
 * arrangørgruppa — og API-et slipper arrangøren inn på
 * `events:create`/`events:update`/`events:manage`.
 */
export function usePriorityUserSearch(): UserSearchState {
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounced(query);
    const { data, isFetching } = useQuery({
        ...searchUsersQuery(debouncedQuery),
        // Under to tegn svarer API-et 400: minstelengden ligger i validatoren.
        enabled: debouncedQuery.length >= 2,
    });

    return {
        query,
        onQueryChange: setQuery,
        results: data ?? [],
        isSearching: isFetching,
    };
}
