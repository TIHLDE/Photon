import { z } from "zod";

export const groupSearchSchema = z
    .object({
        tab: z
            .enum([
                "om",
                "medlemmer",
                "arrangementer",
                "boter",
                "lovverk",
                "sporreskjema",
            ])
            .default("om")
            .catch("om"),
        // Keep fine filters on refresh and in shared links.
        botStatus: z
            .enum(["alle", "pending", "approved", "paid", "rejected"])
            .default("alle")
            .catch("alle"),
        botVisning: z
            .enum(["alle", "per-medlem"])
            .default("alle")
            .catch("alle"),
        botBruker: z.string().optional().catch(undefined),
        // One-time jump within the filters; consumed after opening or fallback.
        botId: z.uuid().optional().catch(undefined),
    })
    .transform((search) =>
        search.botId
            ? {
                  ...search,
                  tab: "boter" as const,
              }
            : search,
    );

export function groupFineFilters(
    search: Pick<
        z.infer<typeof groupSearchSchema>,
        "botStatus" | "botVisning" | "botBruker"
    >,
    ownFinesOnly = false,
) {
    return {
        status:
            search.botStatus !== "alle"
                ? search.botStatus
                : search.botVisning === "per-medlem" && !ownFinesOnly
                  ? ("active" as const)
                  : undefined,
        userId: search.botBruker,
    };
}
