import { route } from "~/lib/route";
import { listAllergiesRoute } from "./list";

export const allergyRoutes = route().route("/", listAllergiesRoute);
