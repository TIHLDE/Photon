import type {
    WrappedCameraReason,
    WrappedCameraStatus,
    WrappedUploadResult,
} from "#/api/queries/wrapped";
import type {
    SetWrappedCamera,
    WrappedPhoto,
    WrappedPhotoList,
} from "#/api/queries/wrapped-admin";

/**
 * Stand-in for API-et til engangskameraet (#865) til #867 er slått sammen.
 *
 * Kamerasida og organisatorens utvalgsfane deler denne tilstanden, så et bilde
 * tatt på kamerasida dukker opp i utvalget og en innstilling slått av i adminen
 * gjelder på kamerasida. Alt lever i minnet og nullstilles ved reload.
 *
 * TODO(#867): slett hele fila når `@tihlde/sdk` har rutene.
 */

/** Sett til en `reason` for å se den tilstanden på kamerasida. */
const MOCK_REASON: WrappedCameraReason | null = null;
/** Sett til 0 for å se tom-tilstanden i utvalget. */
const MOCK_SEED_PHOTOS = 30;
const MOCK_DELAY_MS = 800;

const MOCK_UPLOADERS = [
    "Ola Nordmann",
    "Kari Nordmann",
    "Per Hansen",
    "Ingrid Berg",
    "Jonas Lie",
];

type MockPhoto = {
    id: string;
    createdAt: string;
    selected: boolean;
    uploadedBy: { id: string; name: string };
    /** Bildet fra kamerasida, eller null for et generert plassholderbilde. */
    blob: Blob | null;
};

const camera = { enabled: true, shotsPerPerson: 5 };
let shotsUsed = 0;
const photos: MockPhoto[] = Array.from({ length: MOCK_SEED_PHOTOS }, (_, i) => {
    const uploader = MOCK_UPLOADERS[i % MOCK_UPLOADERS.length]!;
    return {
        id: crypto.randomUUID(),
        createdAt: new Date(
            Date.now() - (MOCK_SEED_PHOTOS - i) * 7 * 60 * 1000,
        ).toISOString(),
        selected: i % 7 === 0,
        uploadedBy: {
            id: `mock-user-${i % MOCK_UPLOADERS.length}`,
            name: uploader,
        },
        blob: null,
    };
});

export class MockHttpError extends Error {
    response: { status: number };
    constructor(status: number) {
        super(`HTTP ${status}`);
        this.response = { status };
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function status(): WrappedCameraStatus {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const shotsLeft = Math.max(camera.shotsPerPerson - shotsUsed, 0);
    const reason =
        MOCK_REASON ??
        (!camera.enabled
            ? ("disabled" as const)
            : shotsLeft === 0
              ? ("no_shots_left" as const)
              : null);
    return {
        enabled: camera.enabled && reason !== "disabled",
        shotsPerPerson: camera.shotsPerPerson,
        opensAt: new Date(
            reason === "not_open_yet" ? now + 3 * hour : now - hour,
        ).toISOString(),
        closesAt: new Date(
            reason === "closed" ? now - hour : now + 6 * hour,
        ).toISOString(),
        isOpen: reason !== "not_open_yet" && reason !== "closed",
        shotsUsed,
        shotsLeft,
        canShoot: reason === null,
        reason,
        // Stand-in-en vet ikke hvem som spør, så alle får se utvalgsfanen.
        // Fanen vises uansett bare for dem som kan administrere arrangementet.
        canManage: true,
    };
}

function serialize(eventId: string, photo: MockPhoto): WrappedPhoto {
    return {
        id: photo.id,
        createdAt: photo.createdAt,
        selected: photo.selected,
        uploadedBy: photo.uploadedBy,
        imageUrl: `/api/event/${eventId}/wrapped/photos/${photo.id}/image`,
    };
}

export async function mockGetCamera(): Promise<WrappedCameraStatus> {
    await wait(MOCK_DELAY_MS / 2);
    return status();
}

export async function mockSetCamera(
    data: SetWrappedCamera,
): Promise<WrappedCameraStatus> {
    await wait(MOCK_DELAY_MS / 2);
    camera.enabled = data.enabled;
    if (data.shotsPerPerson !== undefined) {
        camera.shotsPerPerson = data.shotsPerPerson;
    }
    return status();
}

export async function mockUpload(file: File): Promise<WrappedUploadResult> {
    await wait(MOCK_DELAY_MS);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new TypeError("Failed to fetch");
    }
    const current = status();
    if (current.reason === "no_shots_left") throw new MockHttpError(409);
    if (current.reason) throw new MockHttpError(403);
    shotsUsed += 1;
    const id = crypto.randomUUID();
    photos.push({
        id,
        createdAt: new Date().toISOString(),
        selected: false,
        uploadedBy: { id: "mock-me", name: "Deg (stand-in)" },
        blob: file,
    });
    return {
        id,
        shotsUsed,
        shotsLeft: camera.shotsPerPerson - shotsUsed,
    };
}

export async function mockListPhotos(
    eventId: string,
    page: number,
    pageSize: number,
): Promise<WrappedPhotoList> {
    await wait(MOCK_DELAY_MS / 2);
    const pages = Math.ceil(photos.length / pageSize);
    return {
        totalCount: photos.length,
        pages,
        nextPage: page + 1 >= pages ? null : page + 1,
        selectedCount: photos.filter((photo) => photo.selected).length,
        items: photos
            .slice(page * pageSize, (page + 1) * pageSize)
            .map((photo) => serialize(eventId, photo)),
    };
}

export async function mockUpdatePhoto(
    eventId: string,
    photoId: string,
    selected: boolean,
): Promise<WrappedPhoto> {
    await wait(MOCK_DELAY_MS / 2);
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) throw new MockHttpError(404);
    photo.selected = selected;
    return serialize(eventId, photo);
}

/** Gir en object-URL, som den ekte bilderuta gjennom `fetchPrivateObjectUrl`. */
export async function mockPhotoImage(imageUrl: string): Promise<string> {
    await wait(MOCK_DELAY_MS / 4);
    const index = photos.findIndex((p) => imageUrl.includes(p.id));
    const photo = photos[index];
    if (!photo) throw new MockHttpError(404);
    if (photo.blob) return URL.createObjectURL(photo.blob);

    const hue = (index * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="hsl(${hue} 55% 55%)"/><text x="450" y="660" font-family="sans-serif" font-size="200" text-anchor="middle" fill="white">${index + 1}</text></svg>`;
    return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}
