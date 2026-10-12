import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { uploadErrorMessage } from "#/api/queries/assets";

/**
 * Engangskameraet (tihlde-wrapped). Formen følger kontrakten i #865.
 *
 * TODO(#867): API-et er ikke slått sammen ennå, så status og opplasting er
 * statiske stand-ins her. Når `@tihlde/sdk` har rutene, byttes `queryFn` og
 * `mutationFn` til `apiClient` og stand-in-delen nederst slettes — ingenting
 * utenfor denne fila skal måtte endres.
 */

export type WrappedCameraReason =
    | "disabled"
    | "not_open_yet"
    | "closed"
    | "not_registered"
    | "no_shots_left";

export type WrappedCameraStatus = {
    enabled: boolean;
    shotsPerPerson: number;
    opensAt: string;
    closesAt: string;
    isOpen: boolean;
    shotsUsed: number;
    shotsLeft: number;
    canShoot: boolean;
    reason: WrappedCameraReason | null;
    canManage: boolean;
};

export type WrappedUploadResult = {
    id: string;
    shotsUsed: number;
    shotsLeft: number;
};

const WrappedQueryKeys = {
    camera: ["wrapped", "camera"] as const,
} as const;

export const getWrappedCameraQuery = (eventId: string) =>
    queryOptions({
        queryKey: [...WrappedQueryKeys.camera, eventId],
        queryFn: () => mockGetCamera(),
    });

export const uploadWrappedPhotoMutation = mutationOptions({
    mutationFn: async ({
        file,
    }: {
        eventId: string;
        file: File;
    }): Promise<WrappedUploadResult> => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            return await mockUpload();
        } catch (error) {
            // `cause` beholder den opprinnelige feilen, så ruta kan lese
            // statuskoden (403/409 betyr at statusen er utdatert).
            throw new Error(uploadErrorMessage(error, formData), {
                cause: error,
            });
        }
    },
});

// -- Stand-in til #867 er slått sammen ---------------------------------------

/** Sett til en `reason` for å se den tilstanden på kamerasida. */
const MOCK_REASON: WrappedCameraReason | null = null;
const MOCK_SHOTS_PER_PERSON = 5;
const MOCK_DELAY_MS = 800;

let mockShotsUsed = 0;

class MockHttpError extends Error {
    response: { status: number };
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.response = { status };
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockStatus(): WrappedCameraStatus {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const shotsLeft = MOCK_SHOTS_PER_PERSON - mockShotsUsed;
    const reason =
        MOCK_REASON ?? (shotsLeft <= 0 ? ("no_shots_left" as const) : null);
    return {
        enabled: reason !== "disabled",
        shotsPerPerson: MOCK_SHOTS_PER_PERSON,
        opensAt: new Date(
            reason === "not_open_yet" ? now + 3 * hour : now - hour,
        ).toISOString(),
        closesAt: new Date(
            reason === "closed" ? now - hour : now + 6 * hour,
        ).toISOString(),
        isOpen: reason !== "not_open_yet" && reason !== "closed",
        shotsUsed: mockShotsUsed,
        shotsLeft: Math.max(shotsLeft, 0),
        canShoot: reason === null,
        reason,
        canManage: false,
    };
}

async function mockGetCamera(): Promise<WrappedCameraStatus> {
    await wait(MOCK_DELAY_MS / 2);
    return mockStatus();
}

async function mockUpload(): Promise<WrappedUploadResult> {
    await wait(MOCK_DELAY_MS);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new TypeError("Failed to fetch");
    }
    const status = mockStatus();
    if (status.reason === "no_shots_left") throw new MockHttpError(409);
    if (status.reason) throw new MockHttpError(403);
    mockShotsUsed += 1;
    return {
        id: crypto.randomUUID(),
        shotsUsed: mockShotsUsed,
        shotsLeft: MOCK_SHOTS_PER_PERSON - mockShotsUsed,
    };
}
