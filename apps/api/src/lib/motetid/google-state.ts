import crypto from "node:crypto";

/**
 * HMAC-signed OAuth `state` parameter for the Google Calendar connect flow.
 * Binds the flow to the initiating user and carries a safe relative returnTo.
 */
export type GoogleStatePayload = {
    v: 1;
    userId: string;
    returnTo: string;
    nonce: string;
};

export function signGoogleState(
    payload: GoogleStatePayload,
    secret: string,
): string {
    const payloadB64url = Buffer.from(JSON.stringify(payload), "utf8").toString(
        "base64url",
    );
    const sig = crypto
        .createHmac("sha256", secret)
        .update(payloadB64url)
        .digest("base64url");
    return `${payloadB64url}.${sig}`;
}

export function verifyGoogleState(
    state: string,
    secret: string,
): GoogleStatePayload | null {
    const [payloadB64url, sig] = state.split(".");
    if (!payloadB64url || !sig) return null;

    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payloadB64url)
        .digest("base64url");

    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
        return JSON.parse(
            Buffer.from(payloadB64url, "base64url").toString("utf8"),
        );
    } catch {
        return null;
    }
}

/** Only allow same-site relative paths as post-OAuth return targets. */
export function sanitizeReturnTo(returnTo: string | null | undefined): string {
    if (
        typeof returnTo === "string" &&
        returnTo.startsWith("/") &&
        !returnTo.startsWith("//")
    ) {
        return returnTo;
    }
    return "/";
}
