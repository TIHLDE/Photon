import { route } from "~/lib/route";
import { contactRoute } from "./contact";

export const companyRoutes = route().route("/", contactRoute);
