import { route } from "~/lib/route";
import {
    createExpenseRoute,
    createHsCaseRoute,
    createSportsSupportRoute,
    createSupportRoute,
} from "./create";
import { getAttachmentRoute, getPdfRoute, regeneratePdfRoute } from "./files";
import { getRoute } from "./get";
import { listMineRoute, listRoute } from "./list";
import { optionsRoute } from "./options";
import { updateStatusRoute } from "./update-status";

/**
 * Søknader — utlegg, søknader om støtte, og saker til HS.
 *
 * Ported from the standalone utlegg.tihlde.org portal, which had no database
 * and no authentication on its submit endpoints.
 *
 * Order matters: the literal paths (/mine, /options) must be registered
 * before /:id, or they would be swallowed by the parameterized route.
 */
export const applicationRoutes = route()
    .route("/", optionsRoute)
    .route("/", listMineRoute)
    .route("/", createExpenseRoute)
    .route("/", createSupportRoute)
    .route("/", createSportsSupportRoute)
    .route("/", createHsCaseRoute)
    .route("/", listRoute)
    .route("/", getPdfRoute)
    .route("/", getAttachmentRoute)
    .route("/", regeneratePdfRoute)
    .route("/", updateStatusRoute)
    .route("/", getRoute);
