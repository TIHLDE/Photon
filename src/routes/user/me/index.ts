import { route } from "~/lib/route";
import { settingsRoutes } from "./settings";

export const meRoutes = route().route("/settings", settingsRoutes);
