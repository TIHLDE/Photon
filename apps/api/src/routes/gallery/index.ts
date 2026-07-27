import { route } from "~/lib/route";
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoute } from "./get";
import { listRoute } from "./list";
import { createPicturesRoute } from "./pictures/create";
import { deletePictureRoute } from "./pictures/delete";
import { listPicturesRoute } from "./pictures/list";
import { updatePictureRoute } from "./pictures/update";
import { updateRoute } from "./update";

export const galleryRoutes = route()
    .route("/", createRoute)
    .route("/", listRoute)
    // Picture routes are mounted before the ":slug" album routes so that
    // "/:slug/pictures" is not swallowed by them.
    .route("/", listPicturesRoute)
    .route("/", createPicturesRoute)
    .route("/", updatePictureRoute)
    .route("/", deletePictureRoute)
    .route("/", getRoute)
    .route("/", updateRoute)
    .route("/", deleteRoute);
