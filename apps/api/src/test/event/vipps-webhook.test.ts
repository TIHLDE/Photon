import { createHash, createHmac } from "node:crypto";
import {
    type VippsWebhookRequestParts,
    verifyVippsWebhookSignature,
} from "~/lib/vipps";
import { describe, expect, it } from "vitest";

const SECRET = "super-secret-webhook-key";

/**
 * Builds a set of request parts signed exactly the way Vipps signs webhook
 * callbacks, so we can assert the verifier accepts genuine requests and rejects
 * tampered ones.
 * See https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication/
 */
function signRequest(
    body: string,
    overrides: Partial<Omit<VippsWebhookRequestParts, "rawBody">> = {},
): VippsWebhookRequestParts {
    const method = overrides.method ?? "POST";
    const pathAndQuery = overrides.pathAndQuery ?? "/api/event/payment/webhook";
    const host = overrides.host ?? "api.tihlde.org";
    const date = overrides.date ?? "Thu, 30 Mar 2023 08:38:32 GMT";

    const contentSha256 = createHash("sha256")
        .update(body, "utf-8")
        .digest("base64");

    const stringToSign = `${method}\n${pathAndQuery}\n${date};${host};${contentSha256}`;
    const signature = createHmac("sha256", SECRET)
        .update(stringToSign, "utf-8")
        .digest("base64");

    return {
        method,
        pathAndQuery,
        host,
        date,
        contentSha256: overrides.contentSha256 ?? contentSha256,
        authorization:
            overrides.authorization ??
            `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
        rawBody: body,
    };
}

describe("verifyVippsWebhookSignature", () => {
    const body = JSON.stringify({
        reference: "payment-123",
        name: "AUTHORIZED",
        success: true,
    });

    it("accepts a request with a valid signature", () => {
        const parts = signRequest(body);
        expect(verifyVippsWebhookSignature(parts, SECRET)).toBe(true);
    });

    it("rejects a request signed with a different secret", () => {
        const parts = signRequest(body);
        expect(verifyVippsWebhookSignature(parts, "wrong-secret")).toBe(false);
    });

    it("rejects a request whose body was tampered with after signing", () => {
        const parts = signRequest(body);
        const tampered: VippsWebhookRequestParts = {
            ...parts,
            rawBody: body.replace("payment-123", "payment-999"),
        };
        expect(verifyVippsWebhookSignature(tampered, SECRET)).toBe(false);
    });

    it("rejects a request whose content hash does not match the body", () => {
        const parts = signRequest(body);
        const tampered: VippsWebhookRequestParts = {
            ...parts,
            contentSha256: createHash("sha256")
                .update("some other body", "utf-8")
                .digest("base64"),
        };
        expect(verifyVippsWebhookSignature(tampered, SECRET)).toBe(false);
    });

    it("rejects a request whose signed method or path differs", () => {
        const parts = signRequest(body);
        expect(
            verifyVippsWebhookSignature(
                { ...parts, pathAndQuery: "/api/event/payment/other" },
                SECRET,
            ),
        ).toBe(false);
        expect(
            verifyVippsWebhookSignature({ ...parts, method: "GET" }, SECRET),
        ).toBe(false);
    });

    it("rejects a request with a malformed Authorization header", () => {
        const parts = signRequest(body);
        expect(
            verifyVippsWebhookSignature(
                { ...parts, authorization: "Bearer some-token" },
                SECRET,
            ),
        ).toBe(false);
        expect(
            verifyVippsWebhookSignature(
                { ...parts, authorization: "" },
                SECRET,
            ),
        ).toBe(false);
    });

    it("rejects a request missing the content hash or date headers", () => {
        const parts = signRequest(body);
        expect(
            verifyVippsWebhookSignature(
                { ...parts, contentSha256: "" },
                SECRET,
            ),
        ).toBe(false);
        expect(
            verifyVippsWebhookSignature({ ...parts, date: "" }, SECRET),
        ).toBe(false);
    });
});
