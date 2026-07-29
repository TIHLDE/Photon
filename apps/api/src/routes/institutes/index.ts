import { route } from "~/lib/route";
import { listRoute } from "./list";

export const instituteRoutes = route().route("/", listRoute);
