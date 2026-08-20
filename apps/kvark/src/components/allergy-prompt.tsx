import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { UtensilsCrossed } from "lucide-react";

import {
    AllergyPicker,
    type AllergyOption,
    type AllergySelection,
} from "#/components/allergy-picker";

type AllergyPromptProps = {
    /** Kun de kuraterte valgene — samme liste som innstillingene bruker. */
    options: AllergyOption[];
    value: AllergySelection;
    onChange: (value: AllergySelection) => void;
    /** Om velgeren er foldet ut. */
    isPickerOpen: boolean;
    onOpenPicker: () => void;
    onClosePicker: () => void;
    onSave: () => void;
    /** Lagrer et tomt svar, uten å måtte tømme feltet først. */
    onSaveNone: () => void;
    /** Kalles når medlemmet velger å skjule oppfordringen. */
    onDismiss: () => void;
    isSaving?: boolean;
    isError?: boolean;
};

/**
 * Ber medlemmet oppgi allergier når plassen er betalt og sikret.
 *
 * Her, og ikke bare på profilen, fordi det er nå det er relevant: arrangøren
 * bestiller maten etter påmeldingslista, og folk går ikke innom innstillingene
 * uoppfordret.
 *
 * Velgeren folder seg ut i kortet framfor å åpne en dialog. En dialog klipper
 * nedtrekkslista til sin egen høyde, så lista ble to rader høy — og flyttes
 * lista ut av dialogen igjen, leser dialogen klikket i den som et klikk utenfor
 * og lukker seg uten å ta valget. Inline har lista hele vinduet å vokse i.
 */
export function AllergyPrompt({
    options,
    value,
    onChange,
    isPickerOpen,
    onOpenPicker,
    onClosePicker,
    onSave,
    onSaveNone,
    onDismiss,
    isSaving = false,
    isError = false,
}: AllergyPromptProps) {
    return (
        <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Har du noen allergier?</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
                <span>
                    Plassen din er betalt og klar. Si fra hva du ikke tåler, så
                    vet de som bestiller maten det. Har du ingen, tar det ett
                    trykk.
                </span>

                {isPickerOpen ? (
                    <AllergyPicker
                        options={options}
                        value={value}
                        onChange={onChange}
                        disabled={isSaving}
                    />
                ) : null}

                {isError ? (
                    <span>
                        Svaret ble ikke lagret. Prøv på nytt. Står det seg, gi
                        beskjed til TIHLDE.
                    </span>
                ) : null}

                <div className="flex flex-wrap gap-2">
                    {isPickerOpen ? (
                        <>
                            <Button
                                size="sm"
                                disabled={isSaving}
                                onClick={onSave}
                            >
                                Lagre
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={isSaving}
                                onClick={onClosePicker}
                            >
                                Avbryt
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                disabled={isSaving}
                                onClick={onOpenPicker}
                            >
                                Legg inn allergier
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isSaving}
                                onClick={onSaveNone}
                            >
                                Jeg har ingen
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={onDismiss}
                            >
                                Ikke nå
                            </Button>
                        </>
                    )}
                </div>
            </AlertDescription>
        </Alert>
    );
}
