import { Alert, AlertDescription } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Switch } from "@tihlde/ui/ui/switch";
import { useState } from "react";

import { NumberInput } from "#/components/number-input";
import { formatInOslo } from "#/lib/date";

export const WRAPPED_MIN_SHOTS = 1;
export const WRAPPED_MAX_SHOTS = 20;

export type WrappedCameraSettingsValues = {
    enabled: boolean;
    shotsPerPerson: number;
};

type WrappedCameraSettingsProps = WrappedCameraSettingsValues & {
    opensAt: string;
    closesAt: string;
    isSaving: boolean;
    error: string | null;
    onSave: (values: WrappedCameraSettingsValues) => void;
};

function formatTime(iso: string): string {
    return formatInOslo(iso, "d. MMM yyyy 'kl.' HH:mm");
}

function parseShots(value: string): number | null {
    const shots = Number(value);
    return Number.isInteger(shots) &&
        shots >= WRAPPED_MIN_SHOTS &&
        shots <= WRAPPED_MAX_SHOTS
        ? shots
        : null;
}

/**
 * Organisatorens innstillinger for engangskameraet. Utkastet lever her til det
 * lagres; gi komponenten en ny `key` når de lagrede verdiene endres.
 */
export function WrappedCameraSettings({
    enabled,
    shotsPerPerson,
    opensAt,
    closesAt,
    isSaving,
    error,
    onSave,
}: WrappedCameraSettingsProps) {
    const [enabledDraft, setEnabledDraft] = useState(enabled);
    const [shotsDraft, setShotsDraft] = useState(String(shotsPerPerson));

    const shots = parseShots(shotsDraft);
    const isDirty = enabledDraft !== enabled || shots !== shotsPerPerson;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Engangskamera</CardTitle>
                <CardDescription>
                    Deltakere med plass på arrangementet kan ta bilder med
                    mobilen. Bildene er skjult for alle andre enn arrangøren til
                    de publiseres.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                <Field orientation="horizontal">
                    <Switch
                        id="wrapped-enabled"
                        checked={enabledDraft}
                        onCheckedChange={setEnabledDraft}
                        disabled={isSaving}
                    />
                    <FieldContent>
                        <FieldLabel htmlFor="wrapped-enabled">
                            {enabledDraft ? "Kameraet er på" : "Kameraet er av"}
                        </FieldLabel>
                        <FieldDescription>
                            Åpent fra {formatTime(opensAt)} til{" "}
                            {formatTime(closesAt)}.
                        </FieldDescription>
                    </FieldContent>
                </Field>

                <Field>
                    <FieldLabel htmlFor="wrapped-shots">
                        Bilder per person
                    </FieldLabel>
                    <NumberInput
                        id="wrapped-shots"
                        value={shotsDraft}
                        onValueChange={setShotsDraft}
                        min={WRAPPED_MIN_SHOTS}
                        max={WRAPPED_MAX_SHOTS}
                        step={1}
                        disabled={isSaving}
                        className="max-w-40"
                    />
                    <FieldDescription>
                        Mellom {WRAPPED_MIN_SHOTS} og {WRAPPED_MAX_SHOTS}.
                    </FieldDescription>
                </Field>

                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button
                    disabled={!isDirty || shots === null || isSaving}
                    onClick={() => {
                        if (shots === null) return;
                        onSave({
                            enabled: enabledDraft,
                            shotsPerPerson: shots,
                        });
                    }}
                >
                    {isSaving ? "Lagrer …" : "Lagre"}
                </Button>
            </CardFooter>
        </Card>
    );
}
