/**
 * Norsk stavekontroll i appen.
 *
 * Nettleserens egen stavekontroll krever at hver enkelt bruker har lagt til
 * norsk under språkinnstillingene sine, og utvidelser som Grammarly slår den
 * av på feltene de kobler seg på. Resultatet var at skrivefeil i arrangementer
 * og nyheter aldri ble fanget opp. Denne modulen tar jobben selv, slik at alle
 * arrangører får rød strek uansett nettleser.
 *
 * Ordboka er stor (5,3 MB), så den lastes først når noen faktisk åpner en
 * editor — aldri på de offentlige sidene.
 */

/** Hvor kort en del av et sammensatt ord får være. */
const MIN_COMPOUND_PART = 3;

/**
 * Ord ordboka ikke kjenner, men som er riktige hos oss. Uten disse ville
 * navnet på foreningen fått rød strek i annethvert arrangement.
 */
const CUSTOM_WORDS = [
    "TIHLDE",
    "Index",
    "Drift",
    "Sosialen",
    "Promo",
    "KoK",
    "NoK",
    "Fondet",
    "Plask",
    "Jubkom",
    "Turkom",
    "Redaksjonen",
    "bedpres",
    "bedpresen",
    "vors",
    "nachspiel",
    "fadder",
    "faddere",
    "fadderuke",
    "fadderuka",
    "immatrikuleringsball",
    "linjeforening",
    "linjeforeningen",
    "dataingeniør",
    "dataingeniører",
    "drikkelek",
    "drikkeleker",
    "kontoret",
    "kontorvakt",
    "soundboks",
    "Vipps",
    "NTNU",
    "Kalvskinnet",
    "Gløshaugen",
    "kull",
    "kullet",
];

export type Speller = {
    /** True når ordet ikke finnes i ordboka og heller ikke er en sammensetning. */
    isMisspelled: (word: string) => boolean;
    /** Forslag til retting, tom liste når ordboka ikke har noen. */
    suggest: (word: string) => string[];
};

type NSpell = {
    correct: (word: string) => boolean;
    suggest: (word: string) => string[];
    add: (word: string) => void;
};

/**
 * Hvor de kopierte ordbokfilene ligger. `apps/kvark/scripts/copy-dictionary.ts`
 * legger dem her før dev og build.
 */
const DEFAULT_DICTIONARY_URL = "/dictionaries/nb";

let pending: Promise<Speller | null> | null = null;

/**
 * Last ordboka én gang per side. Feiler lastingen — ordboka mangler, eller
 * nettet er nede — svarer vi null, og editoren faller tilbake på nettleserens
 * egen stavekontroll i stedet for å vise ingenting.
 */
export function loadSpeller(
    baseUrl: string = DEFAULT_DICTIONARY_URL,
): Promise<Speller | null> {
    pending ??= createSpeller(baseUrl).catch((error) => {
        console.warn("Kunne ikke laste den norske ordboka:", error);
        return null;
    });
    return pending;
}

async function createSpeller(baseUrl: string): Promise<Speller> {
    // Begge filene er UTF-8 (`SET UTF-8` øverst i index.aff), og nspell tar
    // imot dem som tekst.
    const [{ default: nspell }, aff, dic] = await Promise.all([
        import("nspell"),
        fetchDictionaryFile(`${baseUrl}/index.aff.txt`),
        fetchDictionaryFile(`${baseUrl}/index.dic.txt`),
    ]);

    const spell = nspell(aff, dic) as unknown as NSpell;
    for (const word of CUSTOM_WORDS) spell.add(word);

    // Det samme ordet står gjerne mange ganger i en tekst, og hvert oppslag
    // koster. Cachen gjør at hvert unike ord bare sjekkes én gang.
    const cache = new Map<string, boolean>();

    function isKnown(word: string): boolean {
        return spell.correct(word) || spell.correct(word.toLowerCase());
    }

    /**
     * Norsk setter sammen ord fritt, og ordboka har ikke alle sammensetningene.
     * Uten dette fikk «bedriftspresentasjon» og «fadderuke» rød strek — verre
     * enn ingen stavekontroll, for da lærer man seg å overse strekene.
     */
    function isCompound(word: string): boolean {
        if (word.length < MIN_COMPOUND_PART * 2) return false;

        for (
            let i = MIN_COMPOUND_PART;
            i <= word.length - MIN_COMPOUND_PART;
            i++
        ) {
            const head = word.slice(0, i);
            const tail = word.slice(i);
            if (!isKnown(tail)) continue;
            if (isKnown(head)) return true;
            // Bindebokstav: bedrift-s-presentasjon, barn-e-hage.
            if (/[se]$/.test(head) && isKnown(head.slice(0, -1))) return true;
        }
        return false;
    }

    return {
        isMisspelled(word) {
            const cached = cache.get(word);
            if (cached !== undefined) return cached;

            const lower = word.toLowerCase();
            const misspelled = !isKnown(word) && !isCompound(lower);
            cache.set(word, misspelled);
            return misspelled;
        },
        suggest(word) {
            return spell.suggest(word).slice(0, 5);
        },
    };
}

async function fetchDictionaryFile(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} svarte ${response.status}`);
    }
    return response.text();
}
