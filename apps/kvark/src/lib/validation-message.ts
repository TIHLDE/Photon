/**
 * Valideringsfeil er det ene svaret uten `message`.
 *
 * `@hono/standard-validator` avviser en ugyldig kropp med
 * `{ success: false, error: [ ...issues ] }` og går aldri innom
 * `globalErrorHandler`. Uten dette blir en presis forklaring — «Too big:
 * expected array to have <=100 items» — til ky sin intetsigende «Request
 * failed with status code 400».
 */
export function validationIssueMessage(data: object): string | undefined {
    if ((data as { success?: unknown }).success !== false) return;

    const issues = (data as { error?: unknown }).error;
    if (!Array.isArray(issues)) return;

    // Én linje per felt, men bare de tre første: resten er som regel samme
    // feil om igjen, og meldingen skal få plass i en alert-boks.
    const lines = issues
        .slice(0, 3)
        .map((issue) => {
            if (!issue || typeof issue !== "object") return null;
            const text = (issue as { message?: unknown }).message;
            if (typeof text !== "string" || !text) return null;

            const path = (issue as { path?: unknown }).path;
            const field = Array.isArray(path)
                ? path
                      .map((segment) =>
                          typeof segment === "object" && segment !== null
                              ? String((segment as { key?: unknown }).key ?? "")
                              : String(segment),
                      )
                      .filter(Boolean)
                      .join(".")
                : "";

            return field ? `${field}: ${text}` : text;
        })
        .filter((line): line is string => line !== null);

    if (lines.length === 0) return;

    const rest = issues.length - lines.length;
    return rest > 0 ? `${lines.join("; ")} (+${rest} til)` : lines.join("; ");
}
