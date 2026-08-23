/**
 * HEIC/HEIF → JPEG i nettleseren.
 *
 * iPhone lagrer bilder som HEIC, og en telefon som deler et bilde videre gjør
 * det ofte i originalformatet. Kjeden ellers takler det ikke i noen ende:
 * Chrome og Firefox kan ikke dekode HEIC i det hele tatt, så både
 * forhåndsvisningen og komprimeringen (som går via en canvas) står igjen med
 * en tom ramme — og API-et tar uansett bare imot JPEG, PNG, GIF og WebP.
 *
 * Derfor konverteres fila før den kommer så langt. Samme grep som utlegg.tihlde.org
 * gjør.
 */

/** Utvidelsene et HEIC-bilde kommer med. */
const HEIC_EXTENSIONS = [".heic", ".heif"];

/** MIME-typene, når nettleseren i det hele tatt setter en. */
const HEIC_MIME_TYPES = ["image/heic", "image/heif", "image/heic-sequence"];

/**
 * Filnavnet må være med i vurderingen: en HEIC-fil som er kommet via en
 * omvei — AirDrop, en chat, et vedlegg — har ofte tom `type`, og noen
 * nettlesere gjetter `application/octet-stream`.
 */
export function isHeicFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
        HEIC_MIME_TYPES.includes(file.type.toLowerCase()) ||
        HEIC_EXTENSIONS.some((extension) => name.endsWith(extension))
    );
}

function toJpegName(name: string): string {
    return name.replace(/\.(heic|heif)$/i, ".jpg");
}

/**
 * Konverterer et HEIC/HEIF-bilde til JPEG. Alt annet sendes tilbake urørt.
 *
 * Kaster med en lesbar melding når fila ikke lar seg konvertere — som regel
 * en variant libheif ikke dekoder — slik at medlemmet får vite at bildet må
 * lagres om på telefonen, i stedet for å møte en tom forhåndsvisning.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
    if (!isHeicFile(file)) return file;

    // Lastes først når noen faktisk velger et HEIC-bilde: dekoderen er en
    // wasm-modul på et par megabyte, og de fleste opplastinger trenger den
    // aldri.
    const { heicTo } = await import("heic-to");

    // `type` er tom på filer som har vært innom en omvei, og dekoderen
    // sniffer uansett innholdet — men en blob med riktig type gir den mindre
    // å gjette på.
    const blob = HEIC_MIME_TYPES.includes(file.type.toLowerCase())
        ? file
        : new Blob([file], { type: "image/heic" });

    try {
        const converted = await heicTo({
            blob,
            type: "image/jpeg",
            quality: 0.9,
        });

        // En ekte `File`, ikke en navngitt `Blob`: skjemaer som sjekker
        // `instanceof File` avviser det siste, og det lastes opp som «blob».
        return new File([converted], toJpegName(file.name), {
            type: "image/jpeg",
            lastModified: file.lastModified,
        });
    } catch (error) {
        throw new Error(
            `Fikk ikke konvertert «${file.name}». Lagre bildet som JPEG på telefonen og prøv igjen.`,
            { cause: error },
        );
    }
}

/** {@link convertHeicToJpeg} over en liste. */
export async function convertHeicFiles(files: File[]): Promise<File[]> {
    return Promise.all(files.map(convertHeicToJpeg));
}
