import { route } from "~/lib/route";
import { updateUserEmailRoute } from "./users/email";

export const adminRoutes = route().route("/users", updateUserEmailRoute);
