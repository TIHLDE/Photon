import { useEffect } from "react";

import type { ApplicationOptions } from "#/api/queries/applications";

export type GroupOption = ApplicationOptions["groups"][number];
export type CcOption = ApplicationOptions["ccOptions"][number];

/** Contact fields prefilled from the signed-in user. */
export type DefaultContact = {
    name: string;
    email: string;
};

export type SubmitHelpers = {
    reset: () => void;
};

/** Så lite av skjema-API-et som `usePrefillContact` faktisk trenger. */
type ContactField = "contactName" | "contactEmail";
type ContactFieldsForm = {
    getFieldValue: (name: ContactField) => string;
    setFieldValue: (name: ContactField, value: string) => void;
};

/**
 * Format a picked date as "YYYY-MM-DD" using local calendar fields.
 *
 * `toISOString()` would shift the date backwards for anyone east of UTC —
 * exactly the bug the old portal worked around by hand.
 */
export function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Fyll inn navn og e-post når sesjonen lander.
 *
 * Sesjonen hentes etter at siden er tegnet, så `defaultValues` rekker aldri å
 * se den — uten dette blir kontaktfeltene stående tomme selv om vi vet hvem
 * som er logget inn. Feltene fylles bare mens de fortsatt er tomme: en søknad
 * kan sendes på vegne av noen andre, og da skal ikke det som er skrevet
 * overskrives idet sesjonen kommer.
 */
export function usePrefillContact(
    form: ContactFieldsForm,
    contact: DefaultContact,
): void {
    useEffect(() => {
        if (contact.name && !form.getFieldValue("contactName")) {
            form.setFieldValue("contactName", contact.name);
        }
        if (contact.email && !form.getFieldValue("contactEmail")) {
            form.setFieldValue("contactEmail", contact.email);
        }
    }, [contact.name, contact.email, form]);
}
