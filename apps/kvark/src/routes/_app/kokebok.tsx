import { createFileRoute } from "@tanstack/react-router";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@tihlde/ui/ui/table";
import {
    ArrowDown,
    ArrowUpDown,
    ArrowUp,
    ChevronRight,
    FileText,
    Folder,
    Github,
    LinkIcon,
    ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
    CookbookCourses,
    CookbookGradeLabels,
    CookbookStudyLabels,
    StudyCookbook,
    type CookbookEntry,
} from "#/data/cookbook";

export const Route = createFileRoute("/_app/kokebok")({
    component: CookbookPage,
});

type StudyId = Extract<keyof typeof CookbookStudyLabels, string>;
type GradeId = Extract<keyof typeof CookbookGradeLabels, string>;
type CourseId = Extract<keyof typeof CookbookCourses, string>;
type CookbookTree = Partial<Record<GradeId, CookbookEntry[]>>;
type CookbookRow = CookbookEntry & {
    id: string;
    grade: GradeId | null;
};
type CookbookTreeItem =
    | {
          type: "study";
          id: StudyId;
          name: string;
          items: CookbookTreeItem[];
      }
    | {
          type: "grade";
          id: GradeId | null;
          studyId: StudyId;
          name: string;
          count: number;
      };

const STUDY_IDS = Object.keys(CookbookStudyLabels) as StudyId[];

const columns: ColumnDef<CookbookRow>[] = [
    {
        accessorKey: "title",
        header: ({ column }) => (
            <SortHeader
                label="Tittel"
                isSorted={column.getIsSorted()}
                onClick={column.getToggleSortingHandler()}
            />
        ),
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <ResourceIcon type={row.original.type} />
                <span>{row.original.title}</span>
            </div>
        ),
    },
    {
        accessorKey: "course",
        header: ({ column }) => (
            <SortHeader
                label="Emne"
                isSorted={column.getIsSorted()}
                onClick={column.getToggleSortingHandler()}
            />
        ),
        cell: ({ row }) => CookbookCourses[row.original.course as CourseId],
        sortingFn: (rowA, rowB) =>
            CookbookCourses[rowA.original.course as CourseId].localeCompare(
                CookbookCourses[rowB.original.course as CourseId],
                "nb",
            ),
    },
    {
        accessorKey: "creator",
        header: "Laget av",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <span>{formatCreator(row.original.creator)}</span>
                {row.original.isOfficial ? (
                    <ShieldCheck className="size-4" aria-label="Verifisert" />
                ) : null}
            </div>
        ),
    },
];

function CookbookPage() {
    const [selectedStudy, setSelectedStudy] = useState<StudyId>("other");
    const [selectedGrade, setSelectedGrade] = useState<GradeId | null>(null);
    const [sorting, setSorting] = useState<SortingState>([]);

    const cookbookTree = useMemo(() => getCookbookTree(), []);
    const entries = useMemo(
        () => getRowsForSelection(selectedStudy, selectedGrade),
        [selectedStudy, selectedGrade],
    );
    const table = useReactTable({
        data: entries,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    function selectStudy(study: StudyId) {
        setSelectedStudy(study);
        setSelectedGrade(getGradesForStudy(study)[0] ?? null);
    }

    function selectGrade(study: StudyId, grade: GradeId) {
        setSelectedStudy(study);
        setSelectedGrade(grade);
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold my-8">Kokeboka</h1>
            <div className=" grid w-full gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <Card size="sm" className="h-fit">
                    <CardContent>
                        <nav
                            aria-label="Kokebokmeny"
                            className="flex flex-col gap-1"
                        >
                            {cookbookTree.map((item) =>
                                renderTreeItem(
                                    item,
                                    selectedStudy,
                                    selectedGrade,
                                    selectStudy,
                                    selectGrade,
                                ),
                            )}
                        </nav>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {CookbookStudyLabels[selectedStudy]}
                            {selectedGrade
                                ? ` / ${CookbookGradeLabels[selectedGrade]}`
                                : ""}
                        </CardTitle>
                        <CardDescription>
                            {entries.length} ressurser
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                          header.column
                                                              .columnDef.header,
                                                          header.getContext(),
                                                      )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.length > 0 ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            tabIndex={0}
                                            role="link"
                                            className="cursor-pointer"
                                            onClick={() =>
                                                openCookbookEntry(
                                                    row.original.url,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    openCookbookEntry(
                                                        row.original.url,
                                                    );
                                                }
                                            }}
                                        >
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )}
                                                    </TableCell>
                                                ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24"
                                        >
                                            Ingen ressurser funnet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function SortHeader({
    label,
    isSorted,
    onClick,
}: {
    label: string;
    isSorted: false | "asc" | "desc";
    onClick: ((event: unknown) => void) | undefined;
}) {
    return (
        <Button variant="ghost" size="sm" onClick={onClick}>
            {label}
            <SortIcon isSorted={isSorted} />
        </Button>
    );
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
    if (isSorted === "asc") {
        return <ArrowUp />;
    }

    if (isSorted === "desc") {
        return <ArrowDown />;
    }

    return <ArrowUpDown />;
}

function getCookbookTree(): CookbookTreeItem[] {
    return STUDY_IDS.map((study) => {
        const grades = getGradesForStudy(study);

        return {
            type: "study",
            id: study,
            name: CookbookStudyLabels[study],
            items:
                grades.length > 0
                    ? grades.map((grade) => ({
                          type: "grade",
                          id: grade,
                          studyId: study,
                          name: CookbookGradeLabels[grade],
                          count: getEntriesForGrade(study, grade).length,
                      }))
                    : [
                          {
                              type: "grade",
                              id: null,
                              studyId: study,
                              name: "Ressurser",
                              count: getEntriesForStudy(study).length,
                          },
                      ],
        };
    });
}

function renderTreeItem(
    item: CookbookTreeItem,
    selectedStudy: StudyId,
    selectedGrade: GradeId | null,
    onSelectStudy: (study: StudyId) => void,
    onSelectGrade: (study: StudyId, grade: GradeId) => void,
) {
    if (item.type === "study") {
        const isSelectedStudy = selectedStudy === item.id;

        return (
            <Collapsible
                key={item.id}
                defaultOpen={isSelectedStudy}
                className="group/collapsible"
            >
                <CollapsibleTrigger
                    render={
                        <Button
                            type="button"
                            variant={isSelectedStudy ? "secondary" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => onSelectStudy(item.id)}
                        />
                    }
                >
                    <ChevronRight className="group-data-open/collapsible:rotate-90" />
                    <Folder />
                    <span>{item.name}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-5">
                    <div className="flex flex-col gap-1">
                        {item.items.map((child) =>
                            renderTreeItem(
                                child,
                                selectedStudy,
                                selectedGrade,
                                onSelectStudy,
                                onSelectGrade,
                            ),
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        );
    }

    const isSelected =
        selectedStudy === item.studyId && selectedGrade === item.id;

    return (
        <Button
            key={`${item.studyId}-${item.id ?? "all"}`}
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() =>
                item.id
                    ? onSelectGrade(item.studyId, item.id)
                    : onSelectStudy(item.studyId)
            }
        >
            <FileText />
            <span>{item.name}</span>
            <Badge variant="outline" className="ml-auto">
                {item.count}
            </Badge>
        </Button>
    );
}

function getRowsForSelection(study: StudyId, grade: GradeId | null) {
    return (
        grade
            ? getEntriesForGrade(study, grade).map((entry, index) =>
                  toCookbookRow(entry, study, grade, index),
              )
            : getEntriesForStudy(study).map((entry, index) =>
                  toCookbookRow(entry, study, null, index),
              )
    ) satisfies CookbookRow[];
}

function toCookbookRow(
    entry: CookbookEntry,
    study: StudyId,
    grade: GradeId | null,
    index: number,
): CookbookRow {
    return {
        ...entry,
        grade,
        id: [
            study,
            grade ?? "all",
            String(entry.course),
            entry.title,
            String(index),
        ].join("-"),
    };
}

function getGradesForStudy(study: StudyId) {
    const section = StudyCookbook[study];

    if (Array.isArray(section)) {
        return [];
    }

    return Object.keys(section) as GradeId[];
}

function getEntriesForStudy(study: StudyId) {
    const section = StudyCookbook[study];

    if (Array.isArray(section)) {
        return section;
    }

    return Object.values(section).flat();
}

function getEntriesForGrade(study: StudyId, grade: GradeId) {
    const section = StudyCookbook[study];

    if (Array.isArray(section)) {
        return [];
    }

    return (section as CookbookTree)[grade] ?? [];
}

function ResourceIcon({ type }: { type: CookbookEntry["type"] }) {
    if (type === "github") {
        return <Github className="size-4" />;
    }

    if (type === "link") {
        return <LinkIcon className="size-4" />;
    }

    return <FileText className="size-4" />;
}

function formatCreator(creator: CookbookEntry["creator"]) {
    return Array.isArray(creator) ? creator.join(", ") : creator;
}

function openCookbookEntry(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
}
