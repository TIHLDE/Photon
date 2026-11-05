import { osloDateParts } from "@photon/auth/academic-year";
import { schema } from "@photon/db";
import type { WrappedStoryLayout } from "@photon/db/schema";
import { toDate } from "date-fns-tz";
import {
    and,
    count,
    desc,
    eq,
    exists,
    gte,
    inArray,
    isNotNull,
    lt,
    or,
    type SQL,
} from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { OSLO_TIME_ZONE } from "~/lib/oslo-day";
import { inStory } from "./story";

/**
 * A semester as members write it: `V2026` is spring 2026 (January–June),
 * `H2026` is autumn 2026 (July–December).
 */
export type Semester = `${"V" | "H"}${number}`;

export const SEMESTER_PATTERN = /^[VH]\d{4}$/;

/**
 * Registrations that count as having been at the event. A no-show held a
 * spot but was not there, and waitlisted or cancelled members never had one.
 */
const ARCHIVE_STATUSES = ["registered", "attended"] as const;

/** The semester an instant falls in, by the Norwegian calendar. */
export function semesterOf(instant: Date): Semester {
    const [year, month] = osloDateParts(instant);
    // Month is zero-indexed: 0–5 is January–June.
    return `${month < 6 ? "V" : "H"}${year}`;
}

/** The instants a semester starts and ends, `[from, to)`, in Oslo time. */
export function semesterRange(semester: Semester): { from: Date; to: Date } {
    const year = Number(semester.slice(1));
    const at = (y: number, month: "01" | "07") =>
        toDate(`${y}-${month}-01T00:00:00`, { timeZone: OSLO_TIME_ZONE });

    return semester.startsWith("V")
        ? { from: at(year, "01"), to: at(year, "07") }
        : { from: at(year, "07"), to: at(year + 1, "01") };
}

/**
 * Events with a published story that `userId` took part in: held a spot on,
 * or sent in a photo. A member whose photos were not picked, or who took none,
 * still sees the story of an event they were at.
 */
function archivedFor(db: AppContext["db"], userId: string): SQL {
    const condition = and(
        isNotNull(schema.wrappedCamera.publishedAt),
        or(
            exists(
                db
                    .select({ eventId: schema.eventRegistration.eventId })
                    .from(schema.eventRegistration)
                    .where(
                        and(
                            eq(
                                schema.eventRegistration.eventId,
                                schema.event.id,
                            ),
                            eq(schema.eventRegistration.userId, userId),
                            inArray(schema.eventRegistration.status, [
                                ...ARCHIVE_STATUSES,
                            ]),
                        ),
                    ),
            ),
            exists(
                db
                    .select({ id: schema.wrappedPhoto.id })
                    .from(schema.wrappedPhoto)
                    .where(
                        and(
                            eq(schema.wrappedPhoto.eventId, schema.event.id),
                            eq(schema.wrappedPhoto.uploadedById, userId),
                            isNotNull(schema.wrappedPhoto.submittedAt),
                        ),
                    ),
            ),
        ),
    );
    // `and` only returns undefined when given nothing.
    return condition as SQL;
}

export type ArchivedStory = {
    id: string;
    slug: string;
    title: string;
    start: Date;
    end: Date;
    imageUrl: string | null;
    publishedAt: Date;
    layout: WrappedStoryLayout;
    semester: Semester;
    photoCount: number;
    myPhotoCount: number;
    coverPhotoId: string | null;
};

export type ArchivePage = {
    totalCount: number;
    items: ArchivedStory[];
    /** Every semester with at least one story, newest first. */
    semesters: Semester[];
};

/**
 * One page of the member's archive, newest event first, optionally limited
 * to one semester. The semester list always covers the whole archive, so the
 * filter can offer every semester whichever one is chosen.
 */
export async function listArchivedStories(
    db: AppContext["db"],
    userId: string,
    {
        semester,
        limit,
        offset,
    }: { semester?: Semester; limit: number; offset: number },
): Promise<ArchivePage> {
    const archived = archivedFor(db, userId);

    // Members are at a few dozen of these over a degree, so reading every
    // start is cheaper than grouping by an Oslo-time expression in SQL.
    const starts = await db
        .select({ start: schema.event.start })
        .from(schema.wrappedCamera)
        .innerJoin(
            schema.event,
            eq(schema.event.id, schema.wrappedCamera.eventId),
        )
        .where(archived)
        .orderBy(desc(schema.event.start));
    const semesters = [...new Set(starts.map((row) => semesterOf(row.start)))];

    const range = semester ? semesterRange(semester) : undefined;
    const where = range
        ? and(
              archived,
              gte(schema.event.start, range.from),
              lt(schema.event.start, range.to),
          )
        : archived;

    const [total] = await db
        .select({ value: count() })
        .from(schema.wrappedCamera)
        .innerJoin(
            schema.event,
            eq(schema.event.id, schema.wrappedCamera.eventId),
        )
        .where(where);

    const events = await db
        .select({
            id: schema.event.id,
            slug: schema.event.slug,
            title: schema.event.title,
            start: schema.event.start,
            end: schema.event.end,
            imageUrl: schema.event.imageUrl,
            publishedAt: schema.wrappedCamera.publishedAt,
            layout: schema.wrappedCamera.storyLayout,
        })
        .from(schema.wrappedCamera)
        .innerJoin(
            schema.event,
            eq(schema.event.id, schema.wrappedCamera.eventId),
        )
        .where(where)
        .orderBy(desc(schema.event.start), desc(schema.event.id))
        .limit(limit)
        .offset(offset);

    const stats = await readArchiveStats(
        db,
        events.map((event) => event.id),
        userId,
    );

    return {
        totalCount: total?.value ?? 0,
        semesters,
        items: events.map((event) => {
            const eventStats = stats.get(event.id);
            return {
                ...event,
                // The `where` keeps only published stories.
                publishedAt: event.publishedAt as Date,
                semester: semesterOf(event.start),
                photoCount: eventStats?.photoCount ?? 0,
                myPhotoCount: eventStats?.myPhotoCount ?? 0,
                coverPhotoId: eventStats?.coverPhotoId ?? null,
            };
        }),
    };
}

type ArchiveStats = {
    photoCount: number;
    myPhotoCount: number;
    coverPhotoId: string | null;
};

/**
 * How many photos each story has, how many of them the member took, and the
 * first photo of each, which the story opens on and the archive shows.
 */
async function readArchiveStats(
    db: AppContext["db"],
    eventIds: string[],
    userId: string,
): Promise<Map<string, ArchiveStats>> {
    const stats = new Map<string, ArchiveStats>();
    if (eventIds.length === 0) return stats;

    const inPage = and(
        inArray(schema.wrappedPhoto.eventId, eventIds),
        inStory(),
    );

    const counts = await db
        .select({
            eventId: schema.wrappedPhoto.eventId,
            photoCount: count(),
        })
        .from(schema.wrappedPhoto)
        .where(inPage)
        .groupBy(schema.wrappedPhoto.eventId);

    const mine = await db
        .select({
            eventId: schema.wrappedPhoto.eventId,
            myPhotoCount: count(),
        })
        .from(schema.wrappedPhoto)
        .where(and(inPage, eq(schema.wrappedPhoto.uploadedById, userId)))
        .groupBy(schema.wrappedPhoto.eventId);

    // The story runs in the order the photos were taken, so its cover is the
    // earliest picked photo.
    const covers = await db
        .selectDistinctOn([schema.wrappedPhoto.eventId], {
            eventId: schema.wrappedPhoto.eventId,
            id: schema.wrappedPhoto.id,
        })
        .from(schema.wrappedPhoto)
        .where(inPage)
        .orderBy(
            schema.wrappedPhoto.eventId,
            schema.wrappedPhoto.createdAt,
            schema.wrappedPhoto.id,
        );

    const myByEvent = new Map(mine.map((row) => [row.eventId, row]));
    const coverByEvent = new Map(covers.map((row) => [row.eventId, row.id]));
    for (const row of counts) {
        stats.set(row.eventId, {
            photoCount: row.photoCount,
            myPhotoCount: myByEvent.get(row.eventId)?.myPhotoCount ?? 0,
            coverPhotoId: coverByEvent.get(row.eventId) ?? null,
        });
    }
    return stats;
}
