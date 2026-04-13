/**
 * In-memory ID mapping stores and transformation utilities
 * for migrating from Lepton (MySQL) to Photon (PostgreSQL).
 */

// ===== ID MAPS =====

/** old content_user.user_id (varchar) -> new auth_user.id */
export const userIdMap = new Map<string, string>();

/** old content_event.id (int) -> new event_event.id (uuid) */
export const eventIdMap = new Map<number, string>();

/** old content_news.id (int) -> new news_news.id (uuid) */
export const newsIdMap = new Map<number, string>();

/** old content_category.id (int) -> new event_category.slug */
export const categoryIdMap = new Map<number, string>();

/** old content_prioritypool.id (int) -> new event_priority_pool.id (uuid) */
export const priorityPoolIdMap = new Map<number, string>();

/** old form id (char32) -> new form_form.id (uuid) — via char32ToUuid */
export const formIdMap = new Map<string, string>();

/** old field id (char32) -> new form_field.id (uuid) */
export const formFieldIdMap = new Map<string, string>();

/** old option id (char32) -> new form_option.id (uuid) */
export const formOptionIdMap = new Map<string, string>();

/** old submission id (char32) -> new form_submission.id (uuid) */
export const formSubmissionIdMap = new Map<string, string>();

/** old answer id (char32) -> new form_answer.id (uuid) */
export const formAnswerIdMap = new Map<string, string>();

/** Users skipped during migration (duplicate emails, etc.) */
export const skippedUsers = new Set<string>();

// ===== TRANSFORMATION UTILS =====

/** Convert a 32-char hex string to UUID format */
export function char32ToUuid(hex: string): string {
    const h = hex.replace(/-/g, "");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Generate a URL-safe slug from a string */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // strip accents
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 200);
}

/** Map old gender int to new gender enum */
export function mapGender(
    value: number | null,
): "male" | "female" | "other" {
    switch (value) {
        case 1:
            return "male";
        case 2:
            return "female";
        default:
            return "other";
    }
}

/** Map old membership_type to new role enum */
export function mapMembershipRole(
    membershipType: string,
): "member" | "leader" {
    return membershipType.toUpperCase() === "LEADER" ? "leader" : "member";
}

/** Map old fine booleans to new status enum */
export function mapFineStatus(
    approved: boolean | number,
    payed: boolean | number,
): "pending" | "approved" | "paid" | "rejected" {
    if (payed) return "paid";
    if (approved) return "approved";
    return "pending";
}

/** Map old registration booleans to new status enum */
export function mapRegistrationStatus(
    hasAttended: boolean | number,
    isOnWait: boolean | number,
): "registered" | "waitlisted" | "attended" {
    if (hasAttended) return "attended";
    if (isOnWait) return "waitlisted";
    return "registered";
}

/** Map old payment_order status to new payment status enum */
export function mapPaymentStatus(
    status: string,
): "pending" | "paid" | "refunded" | "failed" {
    const s = status.toUpperCase();
    if (s === "SALE" || s === "CAPTURED") return "paid";
    if (s === "INITIATE" || s === "RESERVE" || s === "RESERVED") return "pending";
    if (s === "CANCEL" || s === "VOID" || s === "REFUND" || s === "REFUNDED")
        return "refunded";
    return "failed";
}

/** Map old class int (1-5) to new enum */
export function mapUserClass(
    value: number,
): "first" | "second" | "third" | "fourth" | "fifth" | "alumni" {
    const map: Record<number, "first" | "second" | "third" | "fourth" | "fifth"> = {
        1: "first",
        2: "second",
        3: "third",
        4: "fourth",
        5: "fifth",
    };
    return map[value] ?? "first";
}

/** Map old job_type string to new enum */
export function mapJobType(
    value: string,
): "full_time" | "part_time" | "summer_job" | "other" {
    const s = value.toLowerCase().replace(/ /g, "_");
    if (s === "full_time" || s === "fulltime") return "full_time";
    if (s === "part_time" || s === "parttime") return "part_time";
    if (s === "summer_job" || s === "summerjob") return "summer_job";
    return "other";
}

/** Map old form field type to new enum */
export function mapFormFieldType(
    value: string,
): "text_answer" | "multiple_select" | "single_select" {
    const s = value.toLowerCase().replace(/ /g, "_");
    if (s === "multiple_select" || s === "multiple select") return "multiple_select";
    if (s === "single_select" || s === "single select") return "single_select";
    return "text_answer";
}

/** Map old event form type to new enum */
export function mapEventFormType(value: string): "survey" | "evaluation" {
    const s = value.toLowerCase();
    if (s === "evaluation") return "evaluation";
    return "survey";
}

/** Convert MySQL TIME string (HH:MM:SS) to minutes */
export function timeToMinutes(time: string | null): number | null {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length < 2) return null;
    return Number(parts[0]) * 60 + Number(parts[1]);
}

/** Insert records in batches */
export async function batchInsert<T>(
    records: T[],
    batchSize: number,
    insertFn: (batch: T[]) => Promise<void>,
): Promise<void> {
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await insertFn(batch);
    }
}

/** Log progress for a phase */
export function logProgress(phase: string, current: number, total: number): void {
    if (current % 100 === 0 || current === total) {
        console.log(`  [${phase}] ${current}/${total}`);
    }
}
