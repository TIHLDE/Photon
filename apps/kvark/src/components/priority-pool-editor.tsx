import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
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
import { Switch } from "@tihlde/ui/ui/switch";
import { Plus, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@tihlde/ui/ui/avatar";
import {
    UserSearchCombobox,
    type UserSearchOption,
} from "#/components/user-search-combobox";
import { avatarImageUrl } from "#/lib/assets";
import { computeClassYear, initials } from "#/lib/utils";

/** Det minste en pool-velger trenger for å sende en slug videre. */
export type PoolGroup = {
    slug: string;
    name: string;
    /** `STUDYYEAR`, `STUDY`, `COMMITTEE` … Vises som undertekst i lista. */
    type: string;
};

/** En pool er en liste med gruppe-slugs. Rekkefølgen på poolene er uten betydning. */
export type PriorityPool = { groups: string[] };

/**
 * Poolene slik de skal lagres: tomme kastes.
 *
 * En pool uten grupper matcher ingen (`isUserPrioritized` krever
 * `length > 0`), så lagret ville den bare vært en rad som ser ut som en regel
 * uten å være det — og sammen med «bare prioriterte» ville den stengt
 * arrangementet for alle. En nettopp lagt til gruppe brukeren ikke rakk å
 * fylle ut er en mellomtilstand i skjemaet, ikke noe å skrive til databasen.
 */
export function poolsForSubmit(pools: PriorityPool[]): PriorityPool[] {
    return pools.filter((pool) => pool.groups.length > 0);
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
 * «Kull» og «1. klasse i år» på samme rad.
 *
 * Kriteriet som lagres er kull-gruppa — opptaksåret — og det er med vilje:
 * ekte klassetrinn som kriterium hører hjemme i #581, der det utledes ved
 * oppslag i stedet for å fryses ned i arrangementet. Men opptaksår er ikke
 * det arrangøren tenker i. «1. og 4. klasse har prioritet» har fire år på rad
 * blitt kodet som «i år minus tre», regnet i hodet, og bommet minst like ofte
 * som det traff.
 *
 * Så vi sier begge deler: verdien er kullet, og hva kullet betyr akkurat nå.
 * Klassetrinnet vises bare når det er innenfor et studieløp — 2017-kullet er
 * ikke «10. klasse», det er alumni, og da er året det eneste meningsfulle.
 */
function cohortDetail(name: string, now = new Date()): string | null {
    const startYear = Number.parseInt(name, 10);
    if (!Number.isFinite(startYear)) return null;

    const classYear = computeClassYear(startYear, now);
    // 5 er lengste studieløp (master); over det studerer man ikke lenger.
    if (classYear < 1 || classYear > 5) return null;

    return `${classYear}. klasse i år`;
}

/**
 * Norske etiketter for gruppetypene, så lista kan skille «2026» (kull) fra et
 * studie med samme navn. Typene ligger i databasen som fritekst i store
 * bokstaver, arvet fra Lepton.
 */
const TYPE_LABELS: Record<string, string> = {
    STUDYYEAR: "Kull",
    STUDY: "Studie",
    COMMITTEE: "Komité",
    BOARD: "Styre",
    SUBGROUP: "Undergruppe",
    INTERESTGROUP: "Interessegruppe",
    SPORTSTEAM: "Idrettslag",
    TIHLDE: "TIHLDE",
    PRIVATE: "Privat",
};

/**
 * Redigerer prioriteringspoolene på et arrangement.
 *
 * Poolene fantes i databasen og i API-et hele tiden, men begge adminsidene
 * sendte `priorityPools: null`, så feltet var uåpnelig fra nettsiden. Ingen
 * pool var laget i Photon siden Lepton-importen — alle 258 kom derfra — og
 * arrangementer opprettet etter det sto uten prioritering uten at noe sa fra.
 *
 * Semantikken er verdt å lese før du endrer noe her: **alle gruppene i én pool
 * må stemme samtidig, mens det holder å treffe én av poolene.** «1. klasse
 * eller 4. klasse» er derfor to pooler, mens «førsteklassinger på data» er én
 * pool med to grupper. Se `isUserPrioritized` i API-et.
 *
 * Merk at koden og grensesnittet bruker ulike ord med hensikt. API-et og typene
 * her sier «pool» og «grupper», fordi det er det feltene heter. Brukeren ser
 * «prioritert gruppe» og «kriterie», fordi «pool» ikke betyr noe for en
 * arrangør — og fordi «gruppe» i den forstand er nettopp det poolen beskriver:
 * de som skal prioriteres. Endrer du ordene ett sted, gjør det begge.
 */
export function PriorityPoolEditor({
    pools,
    groups,
    onChange,
    users,
    onUsersChange,
    userSearch,
    onlyAllowPrioritized,
    onOnlyAllowPrioritizedChange,
}: PriorityPoolEditorProps) {
    const bySlug = new Map(groups.map((g) => [g.slug, g]));

    /**
     * Private grupper er bøtelag, ikke noe å prioritere etter. De lages
     * automatisk per lag og sier ingenting om hvem arrangementet er for, så de
     * hører ikke hjemme i kriterielista. Typen ligger som fritekst i basen,
     * arvet fra Lepton, derfor sammenligningen uten hensyn til store bokstaver.
     *
     * Filtreres bare bort fra det som kan velges: `bySlug` går fortsatt over
     * alle gruppene, så en pool som allerede peker på en privat gruppe viser
     * navnet sitt i stedet for å forsvinne stille ved lagring.
     */
    const selectableGroups = groups.filter(
        (g) => g.type.toUpperCase() !== "PRIVATE",
    );

    /**
     * En gruppe uten kriterier stenger alle ute i stedet for å slippe noen inn.
     *
     * `isUserPrioritized` krever `poolGroupSlugs.length > 0`, så en tom pool
     * matcher ingen — og API-ets validering ser bare at det *finnes* en pool,
     * ikke at den har innhold. «Bare prioriterte» + én tom gruppe passerer
     * altså validering og gjør arrangementet umulig å melde seg på.
     *
     * Bryteren følger derfor gruppene som faktisk har kriterier, ikke antallet
     * rader i skjemaet. En nettopp lagt til gruppe er en mellomtilstand, ikke
     * et valg.
     */
    const effectivePools = pools.filter((p) => p.groups.length > 0);
    /**
     * Bryteren trenger noen å slippe inn, og en navngitt person teller like
     * mye som en gruppe. Uten den ville «bare prioriterte» vært utilgjengelig
     * på et arrangement der de prioriterte er tre personer og ingen gruppe.
     */
    const hasSomethingPrioritized =
        effectivePools.length > 0 || users.length > 0;

    function updatePool(index: number, next: string[]) {
        const updated = pools.map((p, i) =>
            i === index ? { groups: next } : p,
        );
        onChange(updated);
        if (!updated.some((p) => p.groups.length > 0) && users.length === 0) {
            onOnlyAllowPrioritizedChange(false);
        }
    }

    function removePool(index: number) {
        const next = pools.filter((_, i) => i !== index);
        onChange(next);
        // Kravet i API-et: «bare prioriterte» kan ikke stå igjen uten pooler.
        // Å la den henge ville gitt en 400 ved lagring, uten at feltet som
        // forårsaket den er synlig lenger.
        if (!next.some((p) => p.groups.length > 0) && users.length === 0) {
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
                    Alle prioriterte grupper er likestilte. Legg til flere
                    kriterier i samme gruppe for å oppnå strengere krav.
                    «Førsteklassinger på data» blir én gruppe med kriteriene
                    «Dataingeniør» og «1. klasse».
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {pools.length === 0 ? (
                    <CardDescription>
                        Ingen prioriterte grupper. Alle som kan melde seg på
                        stiller likt.
                    </CardDescription>
                ) : (
                    pools.map((pool, index) => (
                        <div
                            // Poolene har ingen id, og innholdet kan være tomt
                            // mens det redigeres, så posisjonen er det eneste
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
                                    onClick={() => removePool(index)}
                                    aria-label={`Fjern prioritert gruppe ${index + 1}`}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                            <GroupPicker
                                groups={selectableGroups}
                                value={pool.groups
                                    .map((slug) => bySlug.get(slug))
                                    .filter((g): g is PoolGroup => Boolean(g))}
                                onValueChange={(next) =>
                                    updatePool(
                                        index,
                                        next.map((g) => g.slug),
                                    )
                                }
                            />
                        </div>
                    ))
                )}

                <div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange([...pools, { groups: [] }])}
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

function GroupPicker({
    groups,
    value,
    onValueChange,
}: {
    groups: PoolGroup[];
    value: PoolGroup[];
    onValueChange: (next: PoolGroup[]) => void;
}) {
    const anchor = useComboboxAnchor();
    return (
        <Combobox
            items={groups}
            multiple
            value={value}
            onValueChange={onValueChange}
            itemToStringLabel={(item: PoolGroup) => item.name}
            itemToStringValue={(item: PoolGroup) => item.slug}
            isItemEqualToValue={(a: PoolGroup, b: PoolGroup) =>
                a.slug === b.slug
            }
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(selected: PoolGroup[]) => (
                        <>
                            {selected.map((group) => {
                                const detail = cohortDetail(group.name);
                                return (
                                    <ComboboxChip key={group.slug}>
                                        {detail
                                            ? `${group.name} (${detail.replace(" i år", "")})`
                                            : group.name}
                                    </ComboboxChip>
                                );
                            })}
                            <ComboboxChipsInput placeholder="Legg til kriterie" />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxList>
                    <ComboboxEmpty>Ingen treff</ComboboxEmpty>
                    <ComboboxCollection>
                        {(item: PoolGroup) => (
                            <ComboboxItem key={item.slug} value={item}>
                                <span className="flex flex-col">
                                    <span>{item.name}</span>
                                    {/*
                                     * Uten typen er «2026» (kull) umulig å
                                     * skille fra et studie som heter det samme.
                                     */}
                                    <CardDescription>
                                        {[
                                            TYPE_LABELS[
                                                item.type.toUpperCase()
                                            ] ?? item.type,
                                            cohortDetail(item.name),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
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
 * Søket etter personer, slik ruten leverer det.
 *
 * Komponentene her henter ikke data selv (se `apps/kvark/CLAUDE.md`), så
 * spørringen og teksten det søkes på eies av siden som bruker skjemaet.
 */
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
