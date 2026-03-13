import type { paths } from "./types";
import createClient from "openapi-fetch";

export function createPhotonClient(baseURL: string) {
  return createClient<paths>({
    baseUrl: baseURL,
  });
}
