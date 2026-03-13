import type { paths } from "@tihlde/sdk";
import { createOpenApiFetchClient } from "feature-fetch";

export const photonClient = createOpenApiFetchClient<paths>({
  prefixUrl: import.meta.env.VITE_PHOTON_API_URL ?? "https://photon.tihlde.org",
});
