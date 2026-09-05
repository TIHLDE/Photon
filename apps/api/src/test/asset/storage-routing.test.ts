import {
    InMemoryObjectStorageService,
    PrefixRoutedObjectStorageService,
} from "@photon/core/services/storage";
import { describe, expect, it } from "vitest";
import { imageVariantKey } from "~/lib/asset/image";

//
// TODO: REMOVE THIS TEST ONCE DRIFT SERVERS IS BACK UP
//

describe("prefix-routed object storage", () => {
    function stores() {
        const drift = new InMemoryObjectStorageService("drift");
        const r2 = new InMemoryObjectStorageService("r2");
        const routed = new PrefixRoutedObjectStorageService(drift, r2);
        return { drift, r2, routed };
    }

    it("routes writes from the key prefix", async () => {
        const { drift, r2, routed } = stores();

        await routed.put("uploads/drift.png", "drift");
        await routed.put("r2/uploads/new.png", "r2");

        expect(await drift.exists("uploads/drift.png")).toBe(true);
        expect(await r2.exists("uploads/drift.png")).toBe(false);
        expect(await r2.exists("r2/uploads/new.png")).toBe(true);
        expect(await drift.exists("r2/uploads/new.png")).toBe(false);
    });

    it("routes get, exists, and delete from the key prefix", async () => {
        const { drift, r2, routed } = stores();
        await drift.put("uploads/drift.png", "drift");
        await r2.put("r2/uploads/new.png", "r2");

        expect(await routed.get("uploads/drift.png")).toEqual(
            Buffer.from("drift"),
        );
        expect(await routed.get("r2/uploads/new.png")).toEqual(
            Buffer.from("r2"),
        );
        expect(await routed.exists("uploads/drift.png")).toBe(true);
        expect(await routed.exists("r2/uploads/new.png")).toBe(true);

        await routed.delete("uploads/drift.png");
        await routed.delete("r2/uploads/new.png");
        expect(await drift.exists("uploads/drift.png")).toBe(false);
        expect(await r2.exists("r2/uploads/new.png")).toBe(false);
    });

    it("does not fall back when an object exists in the wrong provider", async () => {
        const { drift, r2, routed } = stores();
        await drift.put("r2/uploads/misplaced.png", "drift");
        await r2.put("uploads/misplaced.png", "r2");

        await expect(routed.get("r2/uploads/misplaced.png")).rejects.toThrow(
            "Object not found",
        );
        await expect(routed.get("uploads/misplaced.png")).rejects.toThrow(
            "Object not found",
        );
        expect(await routed.exists("r2/uploads/misplaced.png")).toBe(false);
        expect(await routed.exists("uploads/misplaced.png")).toBe(false);
    });
});

describe("image variant storage keys", () => {
    it("keeps drift variants in their existing namespace", () => {
        expect(imageVariantKey("uploads/drift.png", 320)).toBe(
            "derivatives/w320/uploads/drift.png.webp",
        );
    });

    it("keeps R2 variants under the leading R2 namespace", () => {
        expect(imageVariantKey("r2/uploads/new.png", 320)).toBe(
            "r2/derivatives/w320/uploads/new.png.webp",
        );
    });
});
