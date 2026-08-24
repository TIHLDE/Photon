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
 *
 * `alsoAsk` er for dem som kan melde seg på uten å ha påmeldingsretten
 * globalt: et arrangement som er åpnet for alumni. Uten den fikk alumnen
 * påmeldingen avvist av regelen uten å få se avhukingen som løser den — den
 * bor ellers inne på profilinnstillingene.
 */
export function useEventRulesConsent(alsoAsk = false) {
    const { data: session } = useQuery(authQueryOptions);
    // Alumni og andre uten påmeldingsrett har ingen nytte av varselet — de
    // stoppes uansett et annet sted, med mindre kalleren sier at nettopp her
    // kan de melde seg på.
    const canRegister = usePermission("events:registrations:create");
    const accept = useMutation(updateUserSettingsMutation);

    const mustAccept =
        Boolean(session) &&
        (canRegister || alsoAsk) &&
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
