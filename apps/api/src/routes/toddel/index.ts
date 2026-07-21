import { route } from "~/lib/route";
import { listRoute } from "./list";

export const toddelRoutes = route().route("/", listRoute);
