/**
 * Semestre slik API-et skriver dem: `V2026` er våren 2026 (januar–juni),
 * `H2026` er høsten 2026 (juli–desember).
 */
export type Semester = `${"V" | "H"}${number}`;

const SEMESTER_PATTERN = /^[VH]\d{4}$/;

export function isSemester(value: string): value is Semester {
    return SEMESTER_PATTERN.test(value);
}

/** `H2026` → «Høst 2026». */
export function semesterLabel(semester: string): string {
    if (!isSemester(semester)) return semester;
    return `${semester.startsWith("V") ? "Vår" : "Høst"} ${semester.slice(1)}`;
}
