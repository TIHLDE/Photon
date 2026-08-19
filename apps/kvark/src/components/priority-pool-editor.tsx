import {
    MASTER_CLASS_OFFSET,
    MAX_CLASS_YEAR,
    computeClassYear,
    isMasterStudySlug,
} from "@photon/auth/academic-year";
import {
    Combobox,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@tihlde/ui/ui/combobox";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Switch } from "@tihlde/ui/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import { avatarImageUrl } from "#/lib/assets";
import { initials } from "#/lib/utils";

/** Det minste en pool-velger trenger for å bygge valglista. */
export type PoolGroup = {
    slug: string;
    name: string;
    /** `STUDY`, `COMMITTEE`, `INTERESTGROUP` … Fritekst i store bokstaver. */
    type: string;
};

/**
 * Én pool er ett kriterium: maks én gruppe og maks ett klassetrinn, som må
 * stemme samtidig. Poolene på et arrangement er likestilte — det holder å
 * treffe én av dem.
 */
export type PriorityPool = {
    groupSlug: string | null;
    classYear: number | null;
};

/**
 * Poolene slik de skal lagres: tomme kastes.
 *
 * En pool uten kriterier avvises av API-et (og av en CHECK i databasen), men
 * den oppstår hver gang brukeren trykker «legg til» uten å velge noe ennå.
 * Det er en mellomtilstand i skjemaet, ikke noe å skrive til databasen.
 */
export function poolsForSubmit(pools: PriorityPool[]): PriorityPool[] {
    return pools.filter(isFilled);
}

function isFilled(pool: PriorityPool): boolean {
    return pool.groupSlug !== null || pool.classYear !== null;
}

/** Stabil nøkkel for et valg, så to pooler kan sammenlignes uten dyp likhet. */
export function poolKey(pool: PriorityPool): string {
    return `${pool.groupSlug ?? ""}:${pool.classYear ?? ""}`;
}

/** Ett valg i nedtrekkslista. */
type PoolItem = {
    key: string;
    label: string;
    /** Kort typetekst under navnet, f.eks. «Studie» eller «Komité». */
    hint: string;
    pool: PriorityPool;
    /**
     * Om valget kan snevres inn til ett klassetrinn i feltet ved siden av.
     *
     * Bare bachelorstudiene. Masteren har trinnet i selve valget, og alt annet
     * avvises av API-et hvis det kommer med et trinn.
     */
    supportsClassYear: boolean;
};

/** Trinnene et bachelorstudium kan snevres inn til. */
const BACHELOR_CLASS_YEARS = Array.from(
    { length: MASTER_CLASS_OFFSET },
    (_, i) => i + 1,
);

/** `Select` har ingen tom verdi, så «alle trinn» trenger en egen. */
const ALL_CLASS_YEARS = "all";

/**
 * Norske etiketter for gruppetypene. Typene ligger i databasen som fritekst i
 * store bokstaver, arvet fra Lepton.
 */
const TYPE_LABELS: Record<string, string> = {
    STUDY: "Studie",
    COMMITTEE: "Komité",
    BOARD: "Styre",
    SUBGROUP: "Undergruppe",
    INTERESTGROUP: "Interessegruppe",
    SPORTSTEAM: "Idrettslag",
    TIHLDE: "TIHLDE",
};

/**
 * Gruppetyper som kan velges fritt.
 *
 * Interessegrupper står med vilje ikke her — de slipper bare inn gjennom
 * arrangør-unntaket i {@link buildPoolItems}. Kull (`STUDYYEAR`) er også ute:
 * de er erstattet av klassetrinn, som følger årene i stedet for å fryse fast
 * til ett opptaksår. `PRIVATE` er bøtelag og angår ingen andre.
 *
 * `TIHLDE` er ute fordi den gruppa er alle: å prioritere den er det samme som
 * ikke å prioritere noen, og sammen med «bare prioriterte» ser den ut som en
 * begrensning uten å være det.
 */
const SELECTABLE_TYPES = new Set([
    "STUDY",
    "COMMITTEE",
    "BOARD",
    "SUBGROUP",
    "SPORTSTEAM",
]);

/**
 * Grupper som ligger som `STUDY` i basen uten å være et studium noen går på.
 *
 * «Fondsforvalter» er et verv, og «Drift (studie)» er utfaset — begge ville
 * stått i lista som et studieprogram å prioritere, og ingen av dem har
 * medlemmer det gir mening å slippe fram i køen.
 */
const EXCLUDED_GROUP_SLUGS = new Set(["fondsforvalter", "drift-studie"]);

/**
 * Bygg valglista for én arrangørgruppe.
 *
 * Formen på lista *er* reglene: et valg som ikke finnes, kan ikke velges. Det
 * er derfor ingen utgråingslogikk her for interessegrupper eller for umulige
 * kombinasjoner — de er ikke representerbare. Det eneste som håndheves i
 * grensesnittet er at samme valg ikke kan brukes i to pooler.
 *
 * - 1.–3. klasse står alene, og gjelder alle bachelorstudier.
 * - Bachelorstudiene står som ett valg hver. Trinnet settes i et eget felt ved
 *   siden av, ikke som egne rader i lista: ett valg per studie per trinn ville
 *   blitt titalls nesten like linjer å bla gjennom.
 * - Masteren finnes *bare* som «4. klasse» og «5. klasse»: det er de eneste
 *   trinnene den har, og et bart valg ville stilltiende betydd begge. Den har
 *   derfor ikke trinnfeltet — trinnet ligger allerede i valget.
 * - Arrangørens egen interessegruppe finnes bare som frittstående valg, så den
 *   kan aldri kombineres med et trinn.
 * - `TIHLDE` og gruppene i {@link EXCLUDED_GROUP_SLUGS} finnes ikke: de er
 *   enten alle, et verv eller et utfaset studium.
 */
export function buildPoolItems(
    groups: readonly PoolGroup[],
    organizerGroupSlug: string | null,
): PoolItem[] {
    const items: PoolItem[] = [];

    for (let year = 1; year <= MASTER_CLASS_OFFSET; year++) {
        items.push({
            key: `class:${year}`,
            label: `${year}. klasse`,
            hint: "Klassetrinn",
            pool: { groupSlug: null, classYear: year },
            supportsClassYear: false,
        });
    }

    const studies: PoolItem[] = [];
    const others: PoolItem[] = [];

    for (const group of groups) {
        const type = group.type.toUpperCase();

        if (type === "STUDY" && isMasterStudySlug(group.slug)) {
            for (
                let year = MASTER_CLASS_OFFSET + 1;
                year <= MAX_CLASS_YEAR;
                year++
            ) {
                studies.push({
                    key: `group:${group.slug}+class:${year}`,
                    label: `${group.name} ${year}. klasse`,
                    hint: "Studie",
                    pool: { groupSlug: group.slug, classYear: year },
                    supportsClassYear: false,
                });
            }
            continue;
        }

        // Interessegrupper (og idrettsgruppene, som ligger som interessegrupper
        // med undertype i basen) kan bare prioriteres av seg selv.
        if (type === "INTERESTGROUP") {
            if (group.slug !== organizerGroupSlug) continue;

            others.push({
                key: `group:${group.slug}`,
                label: group.name,
                hint: "Din egen gruppe",
                pool: { groupSlug: group.slug, classYear: null },
                supportsClassYear: false,
            });
            continue;
        }

        if (!SELECTABLE_TYPES.has(type)) continue;
        if (EXCLUDED_GROUP_SLUGS.has(group.slug)) continue;

        const item: PoolItem = {
            key: `group:${group.slug}`,
            label: group.name,
            hint: TYPE_LABELS[type] ?? group.type,
            pool: { groupSlug: group.slug, classYear: null },
            // Bare bachelorstudiene får trinnfeltet: API-et avviser klassetrinn
            // på komiteer, styrer og resten, så et slikt valg ville vært en 400
            // i vente.
            supportsClassYear: type === "STUDY",
        };

        if (type === "STUDY") studies.push(item);
        else others.push(item);
    }

    const byLabel = (a: PoolItem, b: PoolItem) =>
        a.label.localeCompare(b.label, "nb");

    return [...items, ...studies.sort(byLabel), ...others.sort(byLabel)];
}

/** En kull-gruppe har opptaksåret både som slug og som navn, f.eks. «2023». */
const COHORT_SLUG = /^\d{4}$/;

/**
 * Gjør en lagret pool om til noe editoren kan vise, eller null.
 *
 * To ting kan gjøre en lagret pool uvisbar. Kull-pooler fra det gamle systemet
 * ble regnet om til klassetrinn i databasen, så den grenen her er et
 * sikkerhetsnett for rader migreringen ikke traff. Viktigere er den andre:
 * databasen inneholder kombinasjoner den nye velgeren ikke tilbyr — bare «4.
 * klasse» uten studie, eller en interessegruppe som ikke er arrangøren. De
 * virker fortsatt, men API-et avviser dem ved lagring, så de kan ikke bli
 * stående i skjemaet: da hadde brukeren fått en 400 om et kriterium velgeren
 * ikke engang viser.
 *
 * `allowedKeys` er nøklene fra {@link buildPoolItems} for dette arrangementet.
 * Kalleren teller hvor mange som ble null og sier fra.
 */
export function toFormPool(
    pool: {
        classYear: number | null;
        group: { slug: string; name: string } | null;
    },
    allowedKeys: ReadonlySet<string>,
    now = new Date(),
): PriorityPool | null {
    let next: PriorityPool;

    if (pool.group && COHORT_SLUG.test(pool.group.slug)) {
        const startYear = Number.parseInt(pool.group.slug, 10);
        const classYear = computeClassYear(startYear, now);
        if (classYear < 1 || classYear > MAX_CLASS_YEAR) return null;

        next = { groupSlug: null, classYear };
    } else {
        next = {
            groupSlug: pool.group?.slug ?? null,
            classYear: pool.classYear,
        };
    }

    if (!isFilled(next)) return null;

    return allowedKeys.has(poolKey(next)) ? next : null;
}

/**
 * Nøklene til alt som kan velges — se {@link toFormPool}.
 *
 * Trinnvariantene av bachelorstudiene står ikke i valglista, men de kan settes
 * i trinnfeltet, så de hører hjemme her. Det er forskjellen på hva som er
 * *representerbart* og hva som er *én linje i nedtrekket*.
 */
export function allowedPoolKeys(
    groups: readonly PoolGroup[],
    organizerGroupSlug: string | null,
): Set<string> {
    const keys = new Set<string>();

    for (const item of buildPoolItems(groups, organizerGroupSlug)) {
        keys.add(poolKey(item.pool));

        if (!item.supportsClassYear) continue;

        for (const year of BACHELOR_CLASS_YEARS) {
            keys.add(
                poolKey({ groupSlug: item.pool.groupSlug, classYear: year }),
            );
        }
    }

    return keys;
}

/**
 * Valget en lagret pool hører til.
 *
 * Et bachelorstudium med trinn har ingen egen linje i lista — trinnet ligger i
 * feltet ved siden av — så oppslaget faller tilbake til studiet uten trinn.
 */
function itemForPool(
    pool: PriorityPool,
    itemByKey: ReadonlyMap<string, PoolItem>,
): PoolItem | null {
    const exact = itemByKey.get(poolKey(pool));
    if (exact) return exact;

    if (pool.groupSlug === null) return null;

    const base = itemByKey.get(
        poolKey({ groupSlug: pool.groupSlug, classYear: null }),
    );

    return base?.supportsClassYear ? base : null;
}

/**
 * En prioritert enkeltperson, med nok til å vise hvem det er etter at siden er
 * lastet på nytt. Bare `id` sendes til API-et.
 */
export type PriorityUser = UserSearchOption;

type PriorityPoolEditorProps = {
    pools: PriorityPool[];
    /** Alle grupper i TIHLDE — ikke bare de brukeren kan arrangere for. */
    groups: PoolGroup[];
    /** Arrangøren, som avgjør om en interessegruppe kan velges i det hele tatt. */
    organizerGroupSlug: string | null;
    onChange: (pools: PriorityPool[]) => void;
    /** Enkeltpersoner som er prioritert uavhengig av gruppene. */
    users: PriorityUser[];
    onUsersChange: (users: PriorityUser[]) => void;
    /** Søket etter personer eies av ruten — se `userSearch` i `EventForm`. */
    userSearch: UserSearchState;
    onlyAllowPrioritized: boolean;
    onOnlyAllowPrioritizedChange: (next: boolean) => void;
};

/**
 * Redigerer prioriteringspoolene på et arrangement.
 *
 * Semantikken er verdt å lese før du endrer noe her: **hver prioritert gruppe
 * er ett kriterium, og det holder å treffe én av dem.** Modellen tillater bare
 * ett valg per prioritert gruppe: én gruppe, og for bachelorstudiene et
 * klassetrinn ved siden av. Masteren har trinnet i selve valget, fordi 4. og 5.
 * klasse er de eneste den har. En navngitt person teller like mye som en
 * gruppe. Se `isUserPrioritized` i API-et.
 *
 * Klassetrinn er rullerende: det løses mot medlemmets kull ved påmelding, så
 * et arrangement som gjenbrukes til neste år treffer neste års førsteklassinger
 * uten at noen må regne om årstall.
 *
 * Merk at koden og grensesnittet bruker ulike ord med hensikt. API-et og typene
 * her sier «pool», fordi det er det feltene heter. Brukeren ser «prioritert
 * gruppe», fordi «pool» ikke betyr noe for en arrangør. Endrer du ordene ett
 * sted, gjør det begge.
 */
export function PriorityPoolEditor({
    pools,
    groups,
    organizerGroupSlug,
    onChange,
    users,
    onUsersChange,
    userSearch,
    onlyAllowPrioritized,
    onOnlyAllowPrioritizedChange,
}: PriorityPoolEditorProps) {
    const items = useMemo(
        () => buildPoolItems(groups, organizerGroupSlug),
        [groups, organizerGroupSlug],
    );

    const itemByKey = useMemo(
        () => new Map(items.map((item) => [poolKey(item.pool), item])),
        [items],
    );

    /**
     * En prioritert gruppe uten kriterium stenger alle ute i stedet for å
     * slippe noen inn: sammen med «bare prioriterte» ville arrangementet vært
     * umulig å melde seg på. Bryteren følger derfor gruppene som faktisk har
     * et kriterium, ikke antallet rader i skjemaet.
     */
    const effectivePools = pools.filter(isFilled);

    /**
     * Bryteren trenger noen å slippe inn, og en navngitt person teller like
     * mye som en gruppe. Uten den ville «bare prioriterte» vært utilgjengelig
     * på et arrangement der de prioriterte er tre personer og ingen gruppe.
     */
    const hasSomethingPrioritized =
        effectivePools.length > 0 || users.length > 0;

    function commit(next: PriorityPool[]) {
        onChange(next);
        // Kravet i API-et: «bare prioriterte» kan ikke stå igjen uten noen å
        // slippe inn. Å la den henge ville gitt en 400 ved lagring, uten at
        // feltet som forårsaket den er synlig lenger.
        if (!next.some(isFilled) && users.length === 0) {
            onOnlyAllowPrioritizedChange(false);
        }
    }

    function removeUser(userId: string) {
        const next = users.filter((u) => u.id !== userId);
        onUsersChange(next);
        if (effectivePools.length === 0 && next.length === 0) {
            onOnlyAllowPrioritizedChange(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Prioritert påmelding</CardTitle>
                <CardDescription>
                    Hver prioritert gruppe er ett kriterium, og alle er
                    likestilte — det holder å treffe én av dem. Legg til flere
                    rader for «eller». Klassetrinn følger studieåret, så et
                    arrangement som gjenbrukes treffer neste kull av seg selv.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {pools.length === 0 ? (
                    <CardDescription>
                        Ingen prioriterte grupper. Alle som kan melde seg på
                        stiller likt.
                    </CardDescription>
                ) : (
                    pools.map((pool, index) => {
                        // Valg som allerede er brukt i en annen rad, så samme
                        // kriterium ikke kan stå to ganger (API-et gir 400).
                        const takenElsewhere = new Set(
                            pools
                                .filter((_, i) => i !== index)
                                .filter(isFilled)
                                .map(poolKey),
                        );

                        const selected = itemForPool(pool, itemByKey);

                        return (
                            <div
                                // Poolene har ingen id, og kan være tomme mens
                                // de redigeres, så posisjonen er det eneste
                                // stabile å nøkle på.
                                key={index}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <Label>Prioritert gruppe {index + 1}</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            commit(
                                                pools.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            )
                                        }
                                        aria-label={`Fjern prioritert gruppe ${index + 1}`}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                                <PoolPicker
                                    items={items.filter(
                                        (item) =>
                                            !takenElsewhere.has(
                                                poolKey(item.pool),
                                            ),
                                    )}
                                    value={selected}
                                    onValueChange={(next) =>
                                        commit(
                                            pools.map((p, i) =>
                                                i === index
                                                    ? (next?.pool ?? {
                                                          groupSlug: null,
                                                          classYear: null,
                                                      })
                                                    : p,
                                            ),
                                        )
                                    }
                                />
                                {selected?.supportsClassYear ? (
                                    <ClassYearPicker
                                        id={`class-year-${index}`}
                                        value={pool.classYear}
                                        // Et trinn som allerede er brukt med
                                        // samme studie i en annen rad ville
                                        // vært et duplikat, og API-et gir 400.
                                        years={BACHELOR_CLASS_YEARS.filter(
                                            (year) =>
                                                !takenElsewhere.has(
                                                    poolKey({
                                                        groupSlug:
                                                            pool.groupSlug,
                                                        classYear: year,
                                                    }),
                                                ),
                                        )}
                                        onValueChange={(classYear) =>
                                            commit(
                                                pools.map((p, i) =>
                                                    i === index
                                                        ? { ...p, classYear }
                                                        : p,
                                                ),
                                            )
                                        }
                                    />
                                ) : null}
                            </div>
                        );
                    })
                )}

                <div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            onChange([
                                ...pools,
                                { groupSlug: null, classYear: null },
                            ])
                        }
                    >
                        <Plus />
                        Legg til prioritert gruppe
                    </Button>
                </div>

                <PriorityUserPicker
                    users={users}
                    search={userSearch}
                    onAdd={(user) => {
                        if (users.some((u) => u.id === user.id)) return;
                        onUsersChange([...users, user]);
                    }}
                    onRemove={removeUser}
                />

                <Label className="flex items-start gap-3">
                    <Switch
                        checked={onlyAllowPrioritized}
                        disabled={!hasSomethingPrioritized}
                        onCheckedChange={onOnlyAllowPrioritizedChange}
                    />
                    <span className="flex flex-col gap-1">
                        <span>Bare prioriterte kan melde seg på</span>
                        <CardDescription>
                            Uten denne havner alle andre på venteliste i stedet
                            for å bli avvist. Krever minst én prioritert gruppe
                            med et kriterium, eller én prioritert person.
                        </CardDescription>
                    </span>
                </Label>
            </CardContent>
        </Card>
    );
}

function PoolPicker({
    items,
    value,
    onValueChange,
}: {
    items: PoolItem[];
    value: PoolItem | null;
    onValueChange: (next: PoolItem | null) => void;
}) {
    return (
        <Combobox
            items={items}
            value={value}
            onValueChange={onValueChange}
            itemToStringLabel={(item: PoolItem) => item.label}
            itemToStringValue={(item: PoolItem) => item.key}
            isItemEqualToValue={(a: PoolItem, b: PoolItem) => a.key === b.key}
        >
            <ComboboxInput placeholder="Velg kriterie" />
            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: PoolItem) => (
                            <ComboboxItem key={item.key} value={item}>
                                <span className="flex flex-col">
                                    <span>{item.label}</span>
                                    <CardDescription>
                                        {item.hint}
                                    </CardDescription>
                                </span>
                            </ComboboxItem>
                        )}
                    </ComboboxCollection>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

/**
 * Klassetrinnet på et bachelorstudium.
 *
 * Eget felt, ikke egne linjer i valglista: ett valg per studie per trinn ble
 * titalls nesten like linjer å bla gjennom. «Alle trinn» er standard, så et
 * studie uten videre innsnevring betyr hele studiet — samme som før feltet
 * fantes.
 */
function ClassYearPicker({
    id,
    value,
    years,
    onValueChange,
}: {
    id: string;
    value: number | null;
    years: number[];
    onValueChange: (next: number | null) => void;
}) {
    const options = [
        { label: "Alle trinn", value: ALL_CLASS_YEARS },
        ...years.map((year) => ({
            label: `${year}. klasse`,
            value: String(year),
        })),
    ];

    return (
        <div className="flex flex-col gap-1">
            <Label htmlFor={id}>Klassetrinn</Label>
            <Select
                items={options}
                value={value === null ? ALL_CLASS_YEARS : String(value)}
                onValueChange={(next) =>
                    onValueChange(
                        next === ALL_CLASS_YEARS || next === null
                            ? null
                            : Number(next),
                    )
                }
            >
                <SelectTrigger id={id}>
                    <SelectValue placeholder="Alle trinn" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_CLASS_YEARS}>Alle trinn</SelectItem>
                    {years.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                            {year}. klasse
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export type UserSearchState = {
    query: string;
    onQueryChange: (query: string) => void;
    results: PriorityUser[];
    isSearching: boolean;
};

/**
 * Prioriterte enkeltpersoner.
 *
 * Egen liste, ikke enda et kriterium i en prioritert gruppe: kriteriene i en
 * gruppe må stemme samtidig, og «personen er Ola» sammen med «personen går
 * første klasse» ville betydd noe annet enn arrangøren mener. Her er regelen
 * flat — står du i lista, er du prioritert.
 *
 * Søket går mot hele brukerregisteret og ikke bare arrangørgruppa. Den som
 * skal prioriteres er ofte nettopp en utenfor: en fadder, en foredragsholder,
 * en som fikk plass lovet.
 */
function PriorityUserPicker({
    users,
    search,
    onAdd,
    onRemove,
}: {
    users: PriorityUser[];
    search: UserSearchState;
    onAdd: (user: PriorityUser) => void;
    onRemove: (userId: string) => void;
}) {
    // De som allerede står i lista filtreres bort fra treffene: å klikke dem
    // igjen gjør ingenting, og et valg uten virkning ser ut som en feil.
    const selectable = search.results.filter(
        (user) => !users.some((selected) => selected.id === user.id),
    );

    return (
        <div className="flex flex-col gap-2">
            <Label>Prioriterte personer</Label>
            {users.length === 0 ? (
                <CardDescription>
                    Ingen enkeltpersoner er prioritert.
                </CardDescription>
            ) : (
                <ul className="flex flex-col gap-1">
                    {users.map((user) => (
                        <li
                            key={user.id}
                            className="flex items-center justify-between gap-2"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <Avatar className="size-7">
                                    <AvatarImage
                                        src={avatarImageUrl(
                                            user.image ?? undefined,
                                        )}
                                    />
                                    <AvatarFallback>
                                        {initials(user.name ?? "?")}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm">
                                        {user.name ?? user.username}
                                    </span>
                                    {user.username ? (
                                        <CardDescription className="truncate">
                                            {user.username}
                                        </CardDescription>
                                    ) : null}
                                </span>
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemove(user.id)}
                                aria-label={`Fjern ${user.name ?? user.username ?? "person"} fra prioriterte`}
                            >
                                <Trash2 />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            <UserSearchCombobox
                holder={null}
                query={search.query}
                onQueryChange={search.onQueryChange}
                results={selectable}
                isSearching={search.isSearching}
                onSelect={(user) => {
                    onAdd(user);
                    search.onQueryChange("");
                }}
                emptyLabel="Legg til person"
            />
        </div>
    );
}
