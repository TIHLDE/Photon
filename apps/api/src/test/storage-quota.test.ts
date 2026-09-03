import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { globalErrorHandler, isStorageQuotaExceeded } from "~/lib/errors";

/**
 * The shape stack.it's Ceph/RGW actually returned when `photon-files` hit its
 * quota on 3. september 2026, copied field for field from the live response.
 * Note the 403 and the useless `UnknownError` message: nothing but the name
 * says what went wrong, which is why the uploader saw «Internal server error».
 */
function quotaExceededError(): Error {
    const err = new Error("UnknownError");
    err.name = "QuotaExceeded";
    return Object.assign(err, {
        Code: "QuotaExceeded",
        $fault: "client",
        $metadata: { httpStatusCode: 403, attempts: 1 },
        BucketName: "photon-files",
    });
}

function appThrowing(err: unknown) {
    return new Hono().onError(globalErrorHandler).get("/", () => {
        throw err;
    });
}

describe("full object storage", () => {
    test("answers 507 with something the uploader can act on", async () => {
        const res = await appThrowing(quotaExceededError()).request("/");

        expect(res.status).toBe(507);
        await expect(res.json()).resolves.toEqual({
            status: 507,
            message:
                "Lagringsplassen er full, så filen ble ikke lagret. Si fra til Teknologiminister.",
        });
    });

    test("finds the quota error under a wrapper", () => {
        const wrapped = new Error("Kunne ikke lagre filen", {
            cause: quotaExceededError(),
        });

        expect(isStorageQuotaExceeded(wrapped)).toBe(true);
    });

    test("recognises a 507 from stores that use the status instead", () => {
        expect(
            isStorageQuotaExceeded(
                Object.assign(new Error("nope"), {
                    name: "InsufficientStorage",
                    $metadata: { httpStatusCode: 507 },
                }),
            ),
        ).toBe(true);
    });

    /**
     * The quota error arrives as a 403, so matching on the status would turn
     * every permission failure into «lagringsplassen er full».
     */
    test("leaves other 403s alone", async () => {
        const denied = Object.assign(new Error("Access Denied"), {
            name: "AccessDenied",
            Code: "AccessDenied",
            $metadata: { httpStatusCode: 403 },
        });

        expect(isStorageQuotaExceeded(denied)).toBe(false);

        const res = await appThrowing(denied).request("/");
        expect(res.status).toBe(500);
    });
});
