import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
} from "~/middleware/pagination";
import {
    WRAPPED_COMMENT_MAX_LENGTH,
    wrappedPhotoSources,
    wrappedStoryLayouts,
} from "@photon/db/schema";
import { MAX_SHOTS_PER_PERSON, cameraBlockedReasons } from "~/lib/wrapped";
import { SEMESTER_PATTERN, type Semester } from "~/lib/wrapped/archive";

const storyLayoutSchema = z.enum(wrappedStoryLayouts).meta({
    description:
        "How the story is watched: `feed` scrolls up and down, `cards` is a stack swiped to the side",
});

export const eventIdParamSchema = z.object({
    eventId: z.uuid().meta({ description: "Event ID" }),
});

export const photoParamSchema = eventIdParamSchema.extend({
    photoId: z.uuid().meta({ description: "Photo ID" }),
});

/**
 * The widths the organizer's image route serves. Two, not the whole list the
 * asset route allows: every width is another stored object per photo, and the
 * selection view only needs a tile and a lightbox.
 */
export const WRAPPED_IMAGE_WIDTHS = [480, 1920] as const;

export const photoImageQuerySchema = z.object({
    w: z
        .enum(WRAPPED_IMAGE_WIDTHS.map(String) as ["480", "1920"])
        .optional()
        .meta({
            description:
                "Width of a resized WebP variant: 480 for a grid tile, 1920 for a lightbox. Omit for the stored photo.",
        }),
});

export const wrappedCameraSchema = Schema(
    "WrappedCamera",
    z.object({
        enabled: z.boolean().meta({
            description: "Whether the organizer has turned the camera on",
        }),
        shotsPerPerson: z.number().int().meta({
            description: "How many photos each member may take at this event",
        }),
        opensAt: z.iso.datetime().meta({
            description: "When the camera opens: two hours before the event",
        }),
        closesAt: z.iso.datetime().meta({
            description: "When the camera closes: four hours after the event",
        }),
        isOpen: z.boolean().meta({
            description: "Enabled and inside the window right now",
        }),
        shotsUsed: z.number().int().meta({
            description: "Photos the caller has taken at this event",
        }),
        shotsLeft: z.number().int().meta({
            description: "Photos the caller has left",
        }),
        canShoot: z.boolean().meta({
            description: "Whether the caller may upload a photo right now",
        }),
        reason: z.enum(cameraBlockedReasons).nullable().meta({
            description:
                "Why the caller cannot take a photo, or null when they can. The first that applies, in the order of the enum.",
        }),
        draftCount: z.number().int().meta({
            description:
                "The caller's photos not yet submitted. Drafts left at close are sent to the organizer automatically a minute after closing, after which this is 0.",
        }),
        publishedAt: z.iso.datetime().nullable().meta({
            description:
                "When the story went live for members, or null while it is not published",
        }),
        firstPublishedAt: z.iso.datetime().nullable().meta({
            description:
                "When the story was first published. Stays set after unpublishing.",
        }),
        storyLayout: storyLayoutSchema,
        canManage: z.boolean().meta({
            description: "Whether the caller arranges the event",
        }),
    }),
);

export const setWrappedCameraSchema = Schema(
    "SetWrappedCamera",
    z.object({
        enabled: z.boolean().meta({ description: "Turn the camera on or off" }),
        shotsPerPerson: z
            .number()
            .int()
            .min(1)
            .max(MAX_SHOTS_PER_PERSON)
            .optional()
            .meta({
                description:
                    "Photos per member. Omit to keep the current value (5 on a camera that was never configured).",
            }),
        storyLayout: storyLayoutSchema.optional().meta({
            description:
                "How the story is watched. Omit to keep the current value (`feed` on a camera that was never configured).",
        }),
    }),
);

const photoSourceSchema = z.enum(wrappedPhotoSources).meta({
    description:
        "Where the photo came from: the camera screen, or the phone's camera roll. Both cost a shot.",
});

export const uploadWrappedPhotoQuerySchema = z.object({
    source: photoSourceSchema.default("camera"),
    idempotencyKey: z.uuid().optional().meta({
        description:
            "An id the client makes up for this photo (a UUID). Sending the same photo again under the same key never costs a second photo, so a retry after a lost answer is safe.",
    }),
});

export const uploadWrappedPhotoResponseSchema = Schema(
    "WrappedPhotoUploaded",
    z.object({
        id: z.uuid().meta({ description: "Photo ID" }),
        shotsUsed: z.number().int(),
        shotsLeft: z.number().int(),
    }),
);

export const wrappedPhotoSchema = Schema(
    "WrappedPhoto",
    z.object({
        id: z.uuid().meta({ description: "Photo ID" }),
        createdAt: z.iso.datetime().meta({
            description: "When the photo was taken",
        }),
        selected: z.boolean().meta({
            description: "Whether the organizer has picked the photo",
        }),
        source: photoSourceSchema,
        uploadedBy: z.object({
            id: z.string(),
            name: z.string(),
        }),
        imageUrl: z.string().meta({
            description:
                "Path on the API that serves the image to the organizer. Needs the session, so fetch it with credentials rather than using it as an `<img src>` from another origin.",
        }),
    }),
);

export const wrappedPhotoListResponseSchema = Schema(
    "WrappedPhotoList",
    PagniationResponseSchema.extend({
        selectedCount: z.number().int().meta({
            description: "How many of the event's photos are picked",
        }),
        items: z.array(wrappedPhotoSchema).describe("List of photos"),
    }),
);

export const updateWrappedPhotoSchema = Schema(
    "UpdateWrappedPhoto",
    z.object({
        selected: z.boolean().meta({
            description: "Pick the photo, or take it out of the selection",
        }),
    }),
);

export const listWrappedPhotosQuerySchema = z.object({
    selected: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
            value === undefined ? undefined : value === "true",
        )
        .meta({
            description:
                "Only picked photos (`true`) or only photos not picked yet (`false`). The counts always cover the whole event.",
        }),
});

export const selectAllWrappedPhotosSchema = Schema(
    "SelectAllWrappedPhotos",
    z.object({
        selected: z.boolean().meta({
            description:
                "Pick every submitted photo, or take every photo out of the selection",
        }),
    }),
);

export const selectAllWrappedPhotosResponseSchema = Schema(
    "WrappedPhotoSelectionCount",
    z.object({
        totalCount: z.number().int().meta({
            description: "How many photos the event has",
        }),
        selectedCount: z.number().int().meta({
            description: "How many of them are picked now",
        }),
    }),
);

export const openWrappedCamerasSchema = Schema(
    "OpenWrappedCameras",
    z.array(
        z.object({
            eventId: z.uuid(),
            slug: z.string().meta({
                description: "The event's slug, for linking to its camera",
            }),
            title: z.string(),
            imageUrl: z.url().nullable().meta({
                description:
                    "The event's banner image, or null when it has none",
            }),
            imageAlt: z.string().nullable().meta({
                description: "Alt text for the banner image (nullable)",
            }),
            start: z.iso.datetime(),
            end: z.iso.datetime(),
            closesAt: z.iso.datetime().meta({
                description:
                    "When the camera closes: four hours after the event",
            }),
            shotsPerPerson: z.number().int(),
            shotsLeft: z.number().int().meta({
                description:
                    "Photos the caller has left. 0 once every photo is taken; the camera stays listed until it closes.",
            }),
            draftCount: z.number().int().meta({
                description: "The caller's photos not yet submitted",
            }),
        }),
    ),
);

export const myWrappedPhotoSchema = Schema(
    "MyWrappedPhoto",
    z.object({
        id: z.uuid().meta({ description: "Photo ID" }),
        source: photoSourceSchema,
        submitted: z.boolean().meta({
            description:
                "Whether the caller has submitted the photo to the organizer. A draft is seen by nobody else.",
        }),
        createdAt: z.iso.datetime().meta({
            description: "When the photo was taken",
        }),
    }),
);

export const myWrappedPhotoListSchema = Schema(
    "MyWrappedPhotoList",
    z.array(myWrappedPhotoSchema),
);

export const deleteMyWrappedPhotoResponseSchema = Schema(
    "MyWrappedPhotoDeleted",
    z.object({
        shotsUsed: z.number().int(),
        shotsLeft: z.number().int(),
    }),
);

const storyPersonSchema = z.object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable().meta({ description: "Avatar URL" }),
});

export const wrappedStoryPhotoSchema = Schema(
    "WrappedStoryPhoto",
    z.object({
        id: z.uuid().meta({ description: "Photo ID" }),
        takenAt: z.iso.datetime().meta({
            description: "When the photo was taken",
        }),
        photographer: storyPersonSchema,
        imageUrl: z.string().meta({
            description:
                "Path on the API that serves the image. Needs the session, so fetch it with credentials rather than using it as an `<img src>` from another origin.",
        }),
        likeCount: z.number().int(),
        likedByMe: z.boolean(),
        commentCount: z.number().int(),
    }),
);

export const wrappedStorySchema = Schema(
    "WrappedStory",
    PagniationResponseSchema.extend({
        event: z
            .object({
                id: z.uuid(),
                slug: z.string(),
                title: z.string(),
                start: z.iso.datetime(),
                end: z.iso.datetime(),
                imageUrl: z.string().nullable(),
            })
            .meta({
                description: "The event, shown as the first item of the story",
            }),
        publishedAt: z.iso.datetime().nullable().meta({
            description:
                "When the story went live. Null only for an organizer previewing an unpublished story.",
        }),
        layout: storyLayoutSchema,
        items: z
            .array(wrappedStoryPhotoSchema)
            .describe("The picked photos, in the order they were taken"),
    }),
);

export const storyCommentParamSchema = photoParamSchema.extend({
    commentId: z.uuid().meta({ description: "Comment ID" }),
});

export const wrappedPhotoLikesSchema = Schema(
    "WrappedPhotoLikes",
    z.object({
        likeCount: z.number().int(),
        likedByMe: z.boolean(),
    }),
);

export const wrappedPhotoCommentSchema = Schema(
    "WrappedPhotoComment",
    z.object({
        id: z.uuid(),
        body: z.string(),
        createdAt: z.iso.datetime(),
        author: storyPersonSchema,
        canDelete: z.boolean().meta({
            description:
                "Whether the caller may delete the comment: its author, or an organizer of the event",
        }),
    }),
);

export const wrappedPhotoCommentListSchema = Schema(
    "WrappedPhotoCommentList",
    PagniationResponseSchema.extend({
        items: z
            .array(wrappedPhotoCommentSchema)
            .describe("Comments, oldest first"),
    }),
);

export const createWrappedPhotoCommentSchema = Schema(
    "CreateWrappedPhotoComment",
    z.object({
        body: z
            .string()
            .trim()
            .min(1)
            .max(WRAPPED_COMMENT_MAX_LENGTH)
            .meta({ description: "Plain text, 1–500 characters" }),
    }),
);

const semesterSchema = z.string().regex(SEMESTER_PATTERN).meta({
    description:
        "A semester by the Norwegian calendar: `V2026` is January–June 2026, `H2026` is July–December 2026",
    example: "H2026",
});

export const wrappedArchiveQuerySchema = PaginationSchema.extend({
    semester: semesterSchema
        .transform((value) => value as Semester)
        .optional()
        .meta({ description: "Only stories from events in this semester" }),
});

export const wrappedArchiveSchema = Schema(
    "WrappedArchive",
    PagniationResponseSchema.extend({
        semesters: z.array(semesterSchema).meta({
            description:
                "Every semester the caller has a story in, newest first. Covers the whole archive whichever semester is asked for, so a filter can list them all.",
        }),
        items: z
            .array(
                z.object({
                    event: z.object({
                        id: z.uuid(),
                        slug: z.string(),
                        title: z.string(),
                        start: z.iso.datetime(),
                        end: z.iso.datetime(),
                        imageUrl: z.string().nullable(),
                    }),
                    semester: semesterSchema,
                    publishedAt: z.iso.datetime(),
                    layout: storyLayoutSchema,
                    photoCount: z.number().int().meta({
                        description: "Photos in the story",
                    }),
                    myPhotoCount: z.number().int().meta({
                        description:
                            "How many of the story's photos the caller took",
                    }),
                    coverImageUrl: z.string().nullable().meta({
                        description:
                            "Path on the API that serves the story's first photo, or null when no photo is picked any more. Needs the session, like the story's own images.",
                    }),
                }),
            )
            .describe("The stories, newest event first"),
    }),
);
