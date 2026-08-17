import { HTTPException } from "hono/http-exception";

export class DuplicateSubmissionException extends HTTPException {
    constructor() {
        super(409, {
            message: "Spørreskjemaet tillater kun én innsending",
        });
    }
}

/**
 * Et gruppeskjema med svar kan fortsatt redigeres — det er bare endringene som
 * ville tatt svar med seg som stoppes, og meldingen sier hvilke. Se
 * `findDestructiveFieldChanges`.
 */
export class FormHasSubmissionsException extends HTTPException {
    constructor(problems: string[] = []) {
        super(409, {
            message:
                problems.length > 0
                    ? `Endringen ville slettet svar som allerede er sendt inn: ${problems.join("; ")}`
                    : "Spørsmålene kan ikke endres etter at noen har svart på skjemaet",
        });
    }
}

export class FormNotOpenForSubmissionException extends HTTPException {
    constructor() {
        super(403, {
            message: "Spørreskjemaet er ikke åpent for innsending",
        });
    }
}

export class GroupFormOnlyForMembersException extends HTTPException {
    constructor() {
        super(403, {
            message: "Spørreskjemaet er kun åpent for medlemmer av gruppen",
        });
    }
}

export class EventFormAttendanceRequiredException extends HTTPException {
    constructor() {
        super(403, {
            message:
                "Du må ha deltatt på arrangementet for å svare på evalueringen",
        });
    }
}

export class EventRegistrationClosedException extends HTTPException {
    constructor() {
        super(403, {
            message:
                "Kan ikke endre svar etter påmelding er lukket for arrangementet",
        });
    }
}
