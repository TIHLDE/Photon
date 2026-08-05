import { route } from "~/lib/route";
import { setPasswordRoute } from "./set";

export const passwordRoutes = route().route("/", setPasswordRoute);
