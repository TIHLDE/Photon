import { route } from "~/lib/route";
import { downloadRoute } from "./download";
import { getRoute } from "./get";
import { promoteRoute } from "./promote";
import { uploadRoute } from "./upload";

export const assetRoutes = route()
    .route("/", uploadRoute)
    .route("/", getRoute)
    .route("/", promoteRoute)
    .route("/", downloadRoute);
