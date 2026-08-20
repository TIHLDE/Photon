import { useMutation } from "@tanstack/react-query";

import { invalidateAuth } from "#/api/auth";
import { updateUserSettingsMutation } from "#/api/queries/user";
import type { AllergySelection } from "#/components/allergy-picker";

/**
 * Lagrer allergiene til medlemmet selv, uansett hvor i appen de svarer.
 *
 * Finnes som egen hook fordi svaret nå kan gis tre steder: i innstillingene, i
 * dialogen på arrangementssiden, og med «Jeg har ingen» rett i oppfordringen.
 * Alle tre må gjøre det samme etterpå — hente sesjonen på nytt, siden både
 * allergiene og `allergiesConfirmedAt` leses derfra.
 *
 * Et tomt utvalg er et gyldig svar: API-et stempler bekreftelsen så lenge
 * feltene er med, og det er nettopp slik «jeg har ingen allergier» skilles fra
 * «har aldri sett spørsmålet».
 */
export function useSaveAllergies() {
    const updateSettings = useMutation(updateUserSettingsMutation);

    return {
        isPending: updateSettings.isPending,
        isError: updateSettings.isError,
        async save(selection: AllergySelection) {
            await updateSettings.mutateAsync({
                data: {
                    allergies: selection.allergies,
                    customAllergies: selection.customAllergies,
                },
            });
            await invalidateAuth();
        },
    };
}
