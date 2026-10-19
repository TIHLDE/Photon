import type z from "zod";
import type { CameraStatus } from "~/lib/wrapped";
import type { WrappedPhotoSource } from "@photon/db/schema";
import type {
    myWrappedPhotoSchema,
    wrappedCameraSchema,
    wrappedPhotoSchema,
} from "./schema";

export function serializeCameraStatus(
    status: CameraStatus,
): z.infer<typeof wrappedCameraSchema> {
    return {
        ...status,
        opensAt: status.opensAt.toISOString(),
        closesAt: status.closesAt.toISOString(),
    };
}

export function serializePhoto(photo: {
    id: string;
    eventId: string;
    createdAt: Date;
    selectedAt: Date | null;
    source: WrappedPhotoSource;
    uploadedBy: { id: string; name: string };
}): z.infer<typeof wrappedPhotoSchema> {
    return {
        id: photo.id,
        createdAt: photo.createdAt.toISOString(),
        selected: photo.selectedAt !== null,
        source: photo.source,
        uploadedBy: photo.uploadedBy,
        imageUrl: `/api/event/${photo.eventId}/wrapped/photos/${photo.id}/image`,
    };
}

/** The member's view of their own photo: never a URL or a storage key. */
export function serializeMyPhoto(photo: {
    id: string;
    source: WrappedPhotoSource;
    submittedAt: Date | null;
    createdAt: Date;
}): z.infer<typeof myWrappedPhotoSchema> {
    return {
        id: photo.id,
        source: photo.source,
        submitted: photo.submittedAt !== null,
        createdAt: photo.createdAt.toISOString(),
    };
}
