import { Alert, AlertDescription, AlertTitle } from "@tihlde/ui/ui/alert";
import { Button } from "@tihlde/ui/ui/button";
import { KeyRound } from "lucide-react";

type SetPasswordNoticeProps = {
    /**
     * `none` has no password row at all and can set one straight away.
     * `placeholder` carries the value the Lepton migration invented, which
     * nobody knows and which `/user/me/password` refuses to overwrite — so
     * that state has to go through a reset instead.
     */
    state: "none" | "placeholder";
    /** Where the action sends them; the route differs per state. */
    href: string;
};

/**
 * Asks a member who signs in with Feide to give themselves a TIHLDE password.
 *
 * Deliberately not a blocker. They already proved who they are by coming
 * through Feide, and a forced form would land hardest during fadderuka, on
 * students standing at a stand trying to get on with their day. It stays until
 * the password exists rather than being a one-off offer — `/velg-passord` has
 * been skippable all along, and the result is 215 members still carrying a
 * placeholder.
 */
export function SetPasswordNotice({ state, href }: SetPasswordNoticeProps) {
    return (
        <Alert>
            <KeyRound className="size-4" />
            <AlertTitle>Du mangler et TIHLDE-passord</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <span>
                    Med et passord slipper du å gå veien om Feide hver gang du
                    logger inn — og du kommer inn selv om Feide er nede.
                </span>
                <Button size="sm" render={<a href={href} />}>
                    {state === "placeholder"
                        ? "Lag et passord"
                        : "Sett passord"}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
