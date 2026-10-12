import z from "zod";
import { Schema } from "~/lib/openapi";
import { MAX_SHOTS_PER_PERSON, cameraBlockedReasons } from "~/lib/wrapped";

export const eventIdParamSchema = z.object({
    eventId: z.uuid().meta({ description: "Event ID" }),
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
    }),
);

export const uploadWrappedPhotoQuerySchema = z.object({
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
