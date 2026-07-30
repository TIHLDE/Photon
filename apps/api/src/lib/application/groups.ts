/**
 * Group types that can hold a budget, and therefore appear in the group
 * dropdowns on the søknad forms. Study programmes and study years cannot.
 *
 * `board` (Hovedstyret) is deliberately absent: HS is who you apply *to*, not
 * a group you claim an utlegg from the way you would from an undergruppe or
 * komité. Listing it there was misleading.
 *
 * Stored values are the uppercase legacy strings from the Lepton import
 * ("SUBGROUP", "INTERESTGROUP", …), so comparisons are case-insensitive.
 */
const SELECTABLE_GROUP_TYPES = new Set([
    "subgroup",
    "committee",
    "interestgroup",
    "tihlde",
]);

export function isSelectableGroupType(type: string): boolean {
    return SELECTABLE_GROUP_TYPES.has(type.toLowerCase());
}

/**
 * A group's økonomiansvarlig address, the optional CC on an utleggssøknad.
 *
 * TIHLDE's standard format is `okonomiansvarlig.<slug>@tihlde.org`, so this is
 * derived rather than stored: every new interessegruppe gets its CC option the
 * moment the group exists, with nothing to keep in sync. The old portal
 * hardcoded 38 of these in the client and silently lacked an option for any
 * group added afterwards.
 */
export function financeEmailForGroup(slug: string): string {
    return `okonomiansvarlig.${slug}@tihlde.org`;
}
