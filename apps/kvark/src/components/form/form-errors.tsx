import { useFormContext } from "#/hooks/form";
import { FieldError } from "@tihlde/ui/ui/field";

type Issue = { message?: string; path?: PropertyKey[] };

/**
 * Collect the errors no field can show.
 *
 * A schema keeps the issue at the path that failed, and only top-level paths
 * have a field rendering them. An issue on `receipts[0]` — one bad file inside
 * the array — is keyed to a field that does not exist in the form, so nothing
 * marks itself invalid and nothing scrolls into view: the submit button just
 * looks dead. Those issues are surfaced here instead.
 */
function collectUnmapped(error: unknown, out: Issue[]): void {
    if (!error) return;

    if (Array.isArray(error)) {
        for (const entry of error) collectUnmapped(entry, out);
        return;
    }

    if (typeof error === "string") {
        out.push({ message: error });
        return;
    }

    if (typeof error !== "object") return;

    const issue = error as Issue;
    if (typeof issue.message === "string") {
        // A top-level path belongs to a field, which renders it itself.
        if (!issue.path || issue.path.length > 1) out.push(issue);
        return;
    }

    // Standard-schema validators hand back a map of field name -> issues.
    for (const entry of Object.values(error)) collectUnmapped(entry, out);
}

export function FormErrors(
    props: Omit<React.ComponentProps<typeof FieldError>, "errors">,
) {
    const form = useFormContext();

    return (
        <form.Subscribe selector={(state) => state.errors}>
            {(errors) => {
                const unmapped: Issue[] = [];
                collectUnmapped(errors, unmapped);
                return <FieldError {...props} errors={unmapped} />;
            }}
        </form.Subscribe>
    );
}
