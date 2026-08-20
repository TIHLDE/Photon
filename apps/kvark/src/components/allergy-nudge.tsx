import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authQueryOptions } from "#/api/auth";
import { getAllergiesQuery } from "#/api/queries/user";
import type { AllergySelection } from "#/components/allergy-picker";
import { AllergyPrompt } from "#/components/allergy-prompt";
import { useAllergyPrompt } from "#/hooks/use-allergy-prompt";
import { useSaveAllergies } from "#/hooks/use-save-allergies";

type AllergyNudgeProps = {
    eventId: string;
    hasPaid: boolean;
};

const NO_ALLERGIES: AllergySelection = { allergies: [], customAllergies: [] };

/**
 * Oppfordringen om å oppgi allergier, med alt den trenger for å svare.
 *
 * En container framfor props hele veien opp i arrangementsruta: ruta har
 * hverken katalogen eller lagringen fra før, og oppfordringen avgjør selv om
 * den skal vises. Da holder det at ruta sier hvilket arrangement det gjelder
 * og om plassen er betalt.
 */
export function AllergyNudge({ eventId, hasPaid }: AllergyNudgeProps) {
    const { showAllergyPrompt, dismissAllergyPrompt } = useAllergyPrompt(
        eventId,
        hasPaid,
    );
    const { data: session } = useQuery(authQueryOptions);
    const saveAllergies = useSaveAllergies();
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Katalogen hentes først når noen faktisk folder ut velgeren. De aller
    // fleste svarer «Jeg har ingen» eller lar være, og skal ikke betale for et
    // kall de ikke bruker.
    const { data: catalogue } = useQuery({
        ...getAllergiesQuery({ curated: true }),
        enabled: isPickerOpen,
    });

    const savedAllergies = session?.user.settings?.allergies ?? [];
    const savedCustom = session?.user.settings?.customAllergies ?? [];

    const [selection, setSelection] = useState<AllergySelection>(NO_ALLERGIES);

    // Sesjonen kommer inn etter første render. Nøkkelen sammenligner innhold,
    // ikke referanse — arrayene er nye objekter ved hver henting.
    const savedKey = `${savedAllergies.join(",")}|${savedCustom.join(",")}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: savedKey er
    // innholdssammenligningen; å avhenge av arrayene ville løpt hver render.
    useEffect(() => {
        setSelection({
            allergies: savedAllergies,
            customAllergies: savedCustom,
        });
    }, [savedKey]);

    if (!showAllergyPrompt) return null;

    async function save(next: AllergySelection) {
        try {
            await saveAllergies.save(next);
            setIsPickerOpen(false);
        } catch {
            // Feilen vises fra `saveAllergies.isError`, så det er ingenting å
            // gjøre her. Fanges likevel: `mutateAsync` kaster, og uten dette
            // blir hvert mislykket forsøk en ubehandlet promise-rejection.
            // Velgeren blir stående åpen, så svaret kan sendes på nytt.
        }
    }

    return (
        <AllergyPrompt
            options={catalogue ?? []}
            value={selection}
            onChange={setSelection}
            isPickerOpen={isPickerOpen}
            onOpenPicker={() => setIsPickerOpen(true)}
            onClosePicker={() => setIsPickerOpen(false)}
            onSave={() => void save(selection)}
            onSaveNone={() => void save(NO_ALLERGIES)}
            onDismiss={dismissAllergyPrompt}
            isSaving={saveAllergies.isPending}
            isError={saveAllergies.isError}
        />
    );
}
