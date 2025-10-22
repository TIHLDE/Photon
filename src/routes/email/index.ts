import { route } from "../../lib/route";
import { sendEmailRoute } from "./send";

export const emailRoutes = route().route("/", sendEmailRoute);
