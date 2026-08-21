import { Link } from "@tanstack/react-router";
import { Bug } from "lucide-react";

import { IconActionButton } from "./icon-action-button";

/**
 * Snarvei til tilbakemeldingsskjemaet, ved siden av varselbjella. Ligger i
 * headeren og ikke i medlemsmenyen: en feil meldes der man står, ikke etter et
 * søk gjennom menyen.
 */
export function FeedbackButton() {
    return (
        <IconActionButton
            icon={Bug}
            label="Foreslå noe nytt eller meld en feil"
            render={<Link to="/tilbakemelding" />}
        />
    );
}
