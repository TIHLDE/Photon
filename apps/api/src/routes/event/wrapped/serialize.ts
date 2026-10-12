import type z from "zod";
import type { CameraStatus } from "~/lib/wrapped";
import type { wrappedCameraSchema, wrappedPhotoSchema } from "./schema";

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
    uploadedBy: { id: string; name: string };
}): z.infer<typeof wrappedPhotoSchema> {
    return {
        id: photo.id,
        createdAt: photo.createdAt.toISOString(),
        selected: photo.selectedAt !== null,
        uploadedBy: photo.uploadedBy,
        imageUrl: `/api/event/${photo.eventId}/wrapped/photos/${photo.id}/image`,
    };
}
