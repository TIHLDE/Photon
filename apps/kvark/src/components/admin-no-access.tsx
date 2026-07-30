import { LockIcon } from "lucide-react";

import { AdminEmptyState } from "#/components/admin-empty-state";

type AdminNoAccessProps = {
    /** What the viewer would have been able to do here, e.g. "publisere nyheter". */
    action: string;
};

/**
 * Shown in place of an admin tool the viewer lacks the permission for.
 *
 * Used where the whole page is one privileged action (the news editor, the
 * attendance list): hiding just the submit button would leave a form that
 * cannot be submitted, which reads as a bug rather than as missing access.
 */
export function AdminNoAccess({ action }: AdminNoAccessProps) {
    return (
        <AdminEmptyState
            icon={LockIcon}
            title="Du har ikke tilgang"
            description={`Du mangler tilgangen som kreves for å ${action}. Ta kontakt med lederen din hvis du mener du skal ha den.`}
        />
    );
}
