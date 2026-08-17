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

import { computeClassYear } from "#/lib/utils";

/** Det minste en pool-velger trenger for å sende en slug videre. */
export type PoolGroup = {
    slug: string;
    name: string;
    /** `STUDYYEAR`, `STUDY`, `COMMITTEE` … Vises som undertekst i lista. */
    type: string;
};

/** En pool er en liste med gruppe-slugs. Rekkefølgen på poolene er uten betydning. */
export type PriorityPool = { groups: string[] };

type PriorityPoolEditorProps = {
    pools: PriorityPool[];
    /** Alle grupper i TIHLDE — ikke bare de brukeren kan arrangere for. */
    groups: PoolGroup[];
    onChange: (pools: PriorityPool[]) => void;
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
    onlyAllowPrioritized,
    onOnlyAllowPrioritizedChange,
}: PriorityPoolEditorProps) {
    const bySlug = new Map(groups.map((g) => [g.slug, g]));

    function updatePool(index: number, next: string[]) {
        onChange(pools.map((p, i) => (i === index ? { groups: next } : p)));
    }

    function removePool(index: number) {
        const next = pools.filter((_, i) => i !== index);
        onChange(next);
        // Kravet i API-et: «bare prioriterte» kan ikke stå igjen uten pooler.
        // Å la den henge ville gitt en 400 ved lagring, uten at feltet som
        // forårsaket den er synlig lenger.
        if (next.length === 0) onOnlyAllowPrioritizedChange(false);
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
                                groups={groups}
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

                <Label className="flex items-start gap-3">
                    <Switch
                        checked={onlyAllowPrioritized}
                        disabled={pools.length === 0}
                        onCheckedChange={onOnlyAllowPrioritizedChange}
                    />
                    <span className="flex flex-col gap-1">
                        <span>Bare prioriterte kan melde seg på</span>
                        <CardDescription>
                            Uten denne havner alle andre på venteliste i stedet
                            for å bli avvist. Krever minst én prioritert gruppe.
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
