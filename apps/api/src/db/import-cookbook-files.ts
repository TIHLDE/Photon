/**
 * One-shot backfill: copy the cookbook's PDFs and archives from Lepton's Azure
 * blob storage into our own bucket, under the keys
 * `apps/kvark/src/data/cookbook.ts` links to.
 *
 * Idempotent: re-runs overwrite the same keys.
 *
 * Run with:
 *   cd apps/api && bun run src/db/import-cookbook-files.ts
 */
import { fetchWithTimeout } from "@photon/core/http";
import { DISABLED_TIMEOUTS, createDb } from "@photon/db";
import { env } from "~/lib/env";
import { createStorageClient } from "~/lib/storage";

const FILES: [sourceUrl: string, key: string][] = [
    [
        "https://tihldestorage.blob.core.windows.net/applicationzip/775a2919-8770-47ec-a17f-afe847de69caExamenProg1.zip",
        "cookbook/examenprog1-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/233002ba-5c00-4cbc-8065-9b610488813cNotater-innføringsemne.pdf",
        "cookbook/notater-innforingsemne.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/9e8e9a44-6f87-42fa-8400-181bd6a97ceeMatematikk1kompendium.pdf",
        "cookbook/matematikk1kompendium.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/9595b889-b9a8-4188-b87f-6295963e2cd4KOKEBOK_MATTE_METODER_1.pdf",
        "cookbook/kokebok-matte-metoder-1.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/69b8c785-d714-4ac5-b203-c38607165a98Systemutvikling.pdf",
        "cookbook/systemutvikling.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/1e4b5000-ba1b-4cb1-a357-9c2861672418Operativsystemer-Pensum.pdf",
        "cookbook/operativsystemer-pensum.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/2e0aadf6-beef-4d62-9f5a-2811c2c2e303RamanRajaCSPDewailly_2018_BuildingRESTfulWebServiceswithSpring5Lev.pdf",
        "cookbook/ramanrajacspdewailly-2018-buildingrestfulwebserviceswithspring5lev.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/e841f682-3144-442d-9e37-59f376133d7adatabaser_lf.zip",
        "cookbook/databaser-lf-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/f389d986-ceb5-43a9-819d-e146d25175afLF.zip",
        "cookbook/lf-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/cdb9393e-004c-4324-947b-389c4e0a23fbcheatsheet_algdat.pdf",
        "cookbook/cheatsheet-algdat.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/9d9aa112-c62f-4984-84d2-95ed63d3547eOperating%20Systems.pdf",
        "cookbook/operating-systems.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/ed190afe-ccc0-46a5-9f87-5b2dc3455b32OS-solution.zip",
        "cookbook/os-solution-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationzip/2f187a63-440b-4421-a77e-290042e889f1algdat_eksamner.zip",
        "cookbook/algdat-eksamner-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/4dfe7059-33be-43ee-963c-328c72b332acEksamensark.pdf",
        "cookbook/eksamensark.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/015053de-f56d-4244-8fa5-e16426686df5Datakom.pdf",
        "cookbook/datakom.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/ad6c4b3a-5037-4cd7-862c-8e95fdb035bdAlgdat%20sammendrag.pdf",
        "cookbook/algdat-sammendrag.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/7dd6ba1d-8c6c-4860-90cb-7b3ed53594ebINGT%20Summary.pdf",
        "cookbook/ingt-summary.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationzip/e3ed0b0b-5b0e-4c68-b99e-97aa08e324c7LF-INFT1004.zip",
        "cookbook/lf-inft1004-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/6c015f9d-fb6a-4b23-918c-e6b339d08a93Samlingsnotat%20DIFT1003.pdf",
        "cookbook/samlingsnotat-dift1003.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/3a6a3c1a-f287-486c-89f4-7f31caeaffb6Eksamensnotater%20DCST1003.pdf",
        "cookbook/eksamensnotater-dcst1003.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/9605176c-d69c-4784-9f78-d1161d961e50EXPH0300%20Besvarelse.pdf",
        "cookbook/exph0300-besvarelse.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationpdf/e2b8f3a8-70dc-4792-a414-cd71ce84daf3Generelle%20tips%20EXPHIL.pdf",
        "cookbook/generelle-tips-exphil.pdf",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/5fc9edf2-1ef8-45b6-8645-13eeab6468abObjektorientert%20programmering%20kok.zip",
        "cookbook/objektorientert-programmering-kok-zip",
    ],
    [
        "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/75793380-53cd-4b91-950e-dc6663dfa31cDCST2002%20Webutvikling.zip",
        "cookbook/dcst2002-webutvikling-zip",
    ],
];

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
};

async function main() {
    const db = createDb({
        connectionString: env.DATABASE_URL,
        timeouts: DISABLED_TIMEOUTS,
    });
    const bucket = await createStorageClient({ db });

    let imported = 0;
    let failed = 0;

    for (const [sourceUrl, key] of FILES) {
        try {
            const response = await fetchWithTimeout(sourceUrl, {
                timeoutMs: 120_000,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            // The proxy in front of the API answers 403 for any path ending
            // in an archive extension, so those keys carry it as a suffix.
            const filename = key
                .slice(key.lastIndexOf("/") + 1)
                .replace(/-zip$/, ".zip");
            const extension = filename.slice(filename.lastIndexOf(".") + 1);

            await bucket.upload(key, buffer, {
                originalFilename: filename,
                contentType: CONTENT_TYPE_BY_EXTENSION[extension],
                visibility: "public",
            });
            // Promote so the staged-asset cleanup job never reaps the file.
            await bucket.promoteAsset(key);

            imported++;
            console.log(
                `✅ ${env.ROOT_URL}/api/assets/${key} (${buffer.length} B)`,
            );
        } catch (error) {
            failed++;
            console.error(`❌ ${key}: ${sourceUrl}`, error);
        }
    }

    console.log(`\nDone. imported=${imported} failed=${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

await main();
