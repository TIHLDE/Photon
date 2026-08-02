/**
 * Fallback TIHLDE cover image, used everywhere content is missing its own
 * image (event/job/news cards, detail heroes, Töddel covers).
 */
export const DEFAULT_COVER_IMAGE = "/browser-icons/cover-image.webp";

/**
 * Norwegian labels for the shared image dropzone. Kept here so every upload
 * surface — admin panel, søknadsskjemaer, galleri — speaks with one voice.
 */
export const imageDropzoneLabels = {
    typeRejected: "Filtypen støttes ikke",
    dropToUpload: "Slipp for å laste opp",
    limitReached: (max: number) => `Maks ${max} bilder lastet opp`,
    addMore: (count: number, max?: number) =>
        max
            ? `Klikk eller dra for å legge til (${count}/${max})`
            : "Klikk eller dra for å legge til flere",
    replaceSingle: "Klikk eller dra for å bytte bilde",
    defaultPlaceholder: "Klikk eller dra et bilde hit for å laste opp",
    previewLabel: (name: string) => `Forhåndsvis ${name}`,
    removeLabel: "Fjern bilde",
    compressing: "Optimaliserer bilde …",
    replaceImage: "Klikk for å bytte bilde",
};
