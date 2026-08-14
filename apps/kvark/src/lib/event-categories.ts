/**
 * Kategoriene et arrangement kan ha. Listene er kilden både til filteret i den
 * offentlige oversikten og til kategorivalget i admin-skjemaet, slik at man
 * aldri kan opprette et arrangement i en kategori ingen kan filtrere på.
 *
 * Slugene må finnes i `category`-tabellen (se `apps/api/src/db/seed/event.ts`);
 * API-et avviser ukjente slugs.
 */
export type EventCategoryOption = { value: string; label: string };

export const EVENT_CATEGORIES: EventCategoryOption[] = [
    { value: "bedpres", label: "Bedpres" },
    { value: "sosialt", label: "Sosialt" },
    { value: "kurs", label: "Kurs" },
    { value: "fadderuka", label: "Fadderuka" },
    { value: "annet", label: "Annet" },
];

export const ACTIVITY_CATEGORIES: EventCategoryOption[] = [
    { value: "aktivitet", label: "Aktivitet" },
];

/**
 * Bedpres har sin egen fane i oversikten. Kategorien ligger også i
 * `EVENT_CATEGORIES` slik at bedpresser fortsatt dukker opp under
 * «Arrangementer» — fanen er en snarvei, ikke et eget kategorirom.
 */
export const BEDPRES_CATEGORIES: EventCategoryOption[] =
    EVENT_CATEGORIES.filter((category) => category.value === "bedpres");

/** Alt som kan velges i skjemaet — begge fanene i oversikten. */
export const ALL_EVENT_CATEGORIES: EventCategoryOption[] = [
    ...EVENT_CATEGORIES,
    ...ACTIVITY_CATEGORIES,
];
