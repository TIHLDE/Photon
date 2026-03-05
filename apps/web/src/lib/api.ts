import { createPhotonClient } from "@tihlde/sdk";

export const photon = createPhotonClient(
    import.meta.env.VITE_API_URL ?? "http://localhost:4000",
);
