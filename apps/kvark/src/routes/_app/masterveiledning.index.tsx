import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { MasterStudyEntry } from "@tihlde/sdk";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@tihlde/ui/ui/input-group";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@tihlde/ui/ui/toggle-group";
import { GraduationCap, PencilLine, SearchIcon } from "lucide-react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { z } from "zod";

import { getMasterStudiesQuery } from "#/api/queries/master-study";
import { useAnyScopePermission } from "#/hooks/use-permission";
import { ADMIN_SECTION_PERMISSIONS } from "#/lib/admin-sections";
import {
    LOCATION_TYPE_LABELS,
    MASTER_STUDY_PROGRAMS,
    MASTER_STUDY_PROGRAM_SLUGS,
    type MasterStudyLocationType,
    type MasterStudyProgramSlug,
    formatApplicationDeadline,
} from "#/lib/master-study";

const searchSchema = z.object({
    studie: z.enum(MASTER_STUDY_PROGRAM_SLUGS).optional().catch(undefined),
    sted: z.enum(["innland", "utland"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/masterveiledning/")({
    component: MasterStudyPage,
    validateSearch: searchSchema,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getMasterStudiesQuery()),
    head: () => ({ meta: [{ title: "Masterveiledning – TIHLDE" }] }),
});

function MasterStudyPage() {
    const { studie = MASTER_STUDY_PROGRAMS[0].slug, sted } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    const canAdmin = useAnyScopePermission(
        ADMIN_SECTION_PERMISSIONS.masterveiledning,
    );

    function setSearch(next: {
        studie?: MasterStudyProgramSlug;
        sted?: MasterStudyLocationType;
    }) {
        navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
            resetScroll: false,
        });
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="my-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold">Masterveiledning</h1>
                    <p className="text-muted-foreground">
                        Masterstudier i Norge og utlandet som bygger videre på
                        bacheloren din, med erfaringer fra de som har tatt dem.
                    </p>
                </div>
                {canAdmin ? (
                    <Button
                        variant="outline"
                        render={<Link to="/admin/masterveiledning" />}
                    >
                        <PencilLine />
                        Administrer
                    </Button>
                ) : null}
            </div>
            <Suspense fallback={<MasterStudySkeleton />}>
                <MasterStudyCatalogue
                    selectedProgram={studie}
                    locationType={sted ?? null}
                    onSelectProgram={(slug) => setSearch({ studie: slug })}
                    onLocationTypeChange={(value) =>
                        setSearch({ sted: value ?? undefined })
                    }
                />
            </Suspense>
        </div>
    );
}

function MasterStudyCatalogue({
    selectedProgram,
    locationType,
    onSelectProgram,
    onLocationTypeChange,
}: {
    selectedProgram: MasterStudyProgramSlug;
    locationType: MasterStudyLocationType | null;
    onSelectProgram: (slug: MasterStudyProgramSlug) => void;
    onLocationTypeChange: (value: MasterStudyLocationType | null) => void;
}) {
    const { data } = useSuspenseQuery(getMasterStudiesQuery());
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);

    const countByProgram = useMemo(() => {
        const counts = new Map<string, number>();
        for (const entry of data.items) {
            const slug = entry.studyProgram.slug;
            counts.set(slug, (counts.get(slug) ?? 0) + 1);
        }
        return counts;
    }, [data.items]);

    const entries = useMemo(() => {
        const needle = deferredSearch.trim().toLowerCase();
        return data.items.filter(
            (entry) =>
                entry.studyProgram.slug === selectedProgram &&
                (!locationType || entry.locationType === locationType) &&
                (!needle ||
                    [entry.name, entry.location, entry.summary ?? ""].some(
                        (field) => field.toLowerCase().includes(needle),
                    )),
        );
    }, [data.items, selectedProgram, locationType, deferredSearch]);

    const programLabel =
        MASTER_STUDY_PROGRAMS.find((p) => p.slug === selectedProgram)?.label ??
        "";
    const programName =
        data.items.find((e) => e.studyProgram.slug === selectedProgram)
            ?.studyProgram.displayName ?? programLabel;

    return (
        <div className="grid w-full gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <Card size="sm" className="h-fit">
                <CardContent>
                    <nav
                        aria-label="Studieprogrammer"
                        className="flex flex-col gap-1"
                    >
                        {MASTER_STUDY_PROGRAMS.map((program) => (
                            <Button
                                key={program.slug}
                                type="button"
                                variant={
                                    program.slug === selectedProgram
                                        ? "secondary"
                                        : "ghost"
                                }
                                size="sm"
                                className="w-full justify-start gap-2"
                                aria-current={
                                    program.slug === selectedProgram
                                        ? "page"
                                        : undefined
                                }
                                onClick={() => onSelectProgram(program.slug)}
                            >
                                <GraduationCap />
                                <span>{program.label}</span>
                                <Badge variant="outline" className="ml-auto">
                                    {countByProgram.get(program.slug) ?? 0}
                                </Badge>
                            </Button>
                        ))}
                    </nav>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{programName}</CardTitle>
                    <CardDescription>
                        {entries.length}{" "}
                        {entries.length === 1
                            ? "masterstudie"
                            : "masterstudier"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <InputGroup className="w-full sm:max-w-xs">
                            <InputGroupAddon>
                                <SearchIcon />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="search"
                                placeholder="Søk etter navn eller sted"
                                aria-label="Søk i masterstudier"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                        </InputGroup>
                        <ToggleGroup
                            variant="outline"
                            size="sm"
                            value={[locationType ?? "alle"]}
                            onValueChange={(value) => {
                                const next = value[0];
                                if (!next) return;
                                onLocationTypeChange(
                                    next === "alle"
                                        ? null
                                        : (next as MasterStudyLocationType),
                                );
                            }}
                        >
                            <ToggleGroupItem value="alle">Alle</ToggleGroupItem>
                            <ToggleGroupItem value="innland">
                                Innland
                            </ToggleGroupItem>
                            <ToggleGroupItem value="utland">
                                Utland
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                    <MasterStudyTable
                        entries={entries}
                        selectedProgram={selectedProgram}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function MasterStudyTable({
    entries,
    selectedProgram,
}: {
    entries: MasterStudyEntry[];
    selectedProgram: MasterStudyProgramSlug;
}) {
    const navigate = useNavigate();

    function open(entry: MasterStudyEntry) {
        navigate({
            to: "/masterveiledning/$id",
            params: { id: entry.id },
            search: { studie: selectedProgram },
        });
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Studie</TableHead>
                    <TableHead>Sted</TableHead>
                    <TableHead className="hidden md:table-cell">
                        Søknadsfrist
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                        Støtte
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.length > 0 ? (
                    entries.map((entry) => (
                        <TableRow
                            key={entry.id}
                            tabIndex={0}
                            role="link"
                            className="cursor-pointer"
                            onClick={() => open(entry)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                ) {
                                    event.preventDefault();
                                    open(entry);
                                }
                            }}
                        >
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="size-4 shrink-0" />
                                    <span>{entry.name}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span>{entry.location}</span>
                                    <Badge variant="outline">
                                        {
                                            LOCATION_TYPE_LABELS[
                                                entry.locationType
                                            ]
                                        }
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                {formatApplicationDeadline(
                                    entry.applicationDeadline,
                                )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                                {entry.hasFinancialSupport ? (
                                    <Badge variant="secondary">Ja</Badge>
                                ) : (
                                    <span className="text-muted-foreground">
                                        Nei
                                    </span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24">
                            Ingen masterstudier funnet.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

function MasterStudySkeleton() {
    return (
        <div className="grid w-full gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <Card size="sm" className="h-fit">
                <CardContent className="flex flex-col gap-2">
                    {MASTER_STUDY_PROGRAMS.map((program) => (
                        <Skeleton key={program.slug} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                    {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
