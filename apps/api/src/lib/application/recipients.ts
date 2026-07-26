import type { ApplicationType } from "@photon/db/schema";

/**
 * Where each søknad type is sent, carried over from the standalone portal.
 *
 * These are TIHLDE's permanent role addresses, not personal ones — they
 * follow the verv rather than the person, so hardcoding them is the point.
 */
const recipientsByType: Record<ApplicationType, string[]> = {
    expense: ["finansminister@tihlde.org"],
    support: ["finansminister@tihlde.org", "hs@tihlde.org"],
    sports_support: ["idkomleder@tihlde.org", "idkom@tihlde.org"],
    hs_case: ["hs@tihlde.org"],
};

export function recipientsFor(type: ApplicationType): string[] {
    return recipientsByType[type];
}
