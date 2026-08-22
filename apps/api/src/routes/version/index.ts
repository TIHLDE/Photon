import { route } from "~/lib/route";
import { versionRoute } from "./list";

export const versionRoutes = route().route("/", versionRoute);
