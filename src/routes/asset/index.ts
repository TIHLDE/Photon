import { route } from "~/lib/route";
import { downloadRoute } from "./download";
import { getRoute } from "./get";
import { uploadRoute } from "./upload";

export const assetRoutes = route()
    .route("/", uploadRoute)
    .route("/", getRoute)
    .route("/", downloadRoute);
