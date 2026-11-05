import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { type Semester, isSemester, semesterLabel } from "#/lib/semester";

type WrappedArchiveSemesterPickerProps = {
    /** Semestrene man har en story i, nyeste først. */
    semesters: readonly Semester[];
    /** `null` er alle semestre. */
    value: Semester | null;
    onValueChange: (semester: Semester | null) => void;
};

/** Select-en trenger en konkret verdi for «alle». */
const ALL_SEMESTERS = "alle";

export function WrappedArchiveSemesterPicker({
    semesters,
    value,
    onValueChange,
}: WrappedArchiveSemesterPickerProps) {
    const items = [
        { value: ALL_SEMESTERS, label: "Alle semestre" },
        ...semesters.map((semester) => ({
            value: semester,
            label: semesterLabel(semester),
        })),
    ];

    return (
        <Select
            items={items}
            value={value ?? ALL_SEMESTERS}
            onValueChange={(next) =>
                onValueChange(next && isSemester(next) ? next : null)
            }
        >
            <SelectTrigger
                className="w-full sm:w-56"
                aria-label="Velg semester"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                        {item.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
