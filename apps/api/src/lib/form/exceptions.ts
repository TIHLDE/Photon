import { HTTPException } from "hono/http-exception";

export class DuplicateSubmissionException extends HTTPException {
    constructor() {
        super(409, {
            message: "Spørreskjemaet tillater kun én innsending",
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
