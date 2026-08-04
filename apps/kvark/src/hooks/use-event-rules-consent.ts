import { useMutation, useQuery } from "@tanstack/react-query";

import { authQueryOptions, invalidateAuth } from "#/api/auth";
import { updateUserSettingsMutation } from "#/api/queries/user";
import { usePermission } from "#/hooks/use-permission";

/**
 * Om medlemmet mangler godkjenning av arrangementsreglene, og handlingen som
 * fikser det.
 *
 * API-et avviser påmelding uten godkjenning, så dette må vises før
 * påmeldingen åpner — ikke i det sekundet plassene slippes.
 */
export function useEventRulesConsent() {
    const { data: session } = useQuery(authQueryOptions);
    // Alumni og andre uten påmeldingsrett har ingen nytte av varselet — de
    // stoppes uansett et annet sted.
    const canRegister = usePermission("events:registrations:create");
    const accept = useMutation(updateUserSettingsMutation);

    const mustAccept =
        Boolean(session) &&
        canRegister &&
        session?.user.settings?.acceptsEventRules !== true;

    return {
        mustAccept,
        isSubmitting: accept.isPending,
        error: accept.error
            ? "Kunne ikke lagre godkjenningen. Prøv igjen."
            : null,
        async acceptEventRules() {
            await accept.mutateAsync({ data: { acceptsEventRules: true } });
            // Godkjenningen ligger i sesjonen, så den må hentes på nytt for at
            // påmeldingsknappen skal dukke opp uten en refresh.
            await invalidateAuth();
        },
    };
}
