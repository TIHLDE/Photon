import type z from "zod";
import type { CameraStatus } from "~/lib/wrapped";
import type { wrappedCameraSchema } from "./schema";

export function serializeCameraStatus(
    status: CameraStatus,
): z.infer<typeof wrappedCameraSchema> {
    return {
        ...status,
        opensAt: status.opensAt.toISOString(),
        closesAt: status.closesAt.toISOString(),
    };
}
