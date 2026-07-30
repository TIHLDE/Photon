/**
 * Group types that can hold a budget, and therefore appear in the group
 * dropdowns on the søknad forms. Study programmes and study years cannot.
 *
 * `board` (Hovedstyret) belongs here even though HS is also who a søknad is
 * addressed *to*: the dropdown asks which group you are acting on behalf of,
 * and HS holds its own budget. Someone on HS submits utlegg on HS' behalf,
 * and HS submits søknader on its own behalf, so removing it would take away
 * both — along with HS' økonomiansvarlig CC address.
 *
 * Stored values are the uppercase legacy strings from the Lepton import
 * ("SUBGROUP", "INTERESTGROUP", …), so comparisons are case-insensitive.
 */
const SELECTABLE_GROUP_TYPES = new Set([
    "subgroup",
    "committee",
    "interestgroup",
    "board",
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
