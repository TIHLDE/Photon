import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Client, type GetPaymentResponse } from "@vippsmobilepay/sdk";
import type { Context } from "hono";
import { getRedis } from "./cache";
import { env } from "./env";

function getVippsClient() {
    if (
        !env.VIPPS_MERCHANT_SERIAL_NUMBER ||
        !env.VIPPS_SUBSCRIPTION_KEY ||
        !env.VIPPS_CLIENT_ID ||
        !env.VIPPS_CLIENT_SECRET
    ) {
        throw new Error(
            "Vipps is not configured properly. Please set VIPPS_MERCHANT_SERIAL_NUMBER, VIPPS_SUBSCRIPTION_KEY, VIPPS_CLIENT_ID, and VIPPS_CLIENT_SECRET in your environment variables.",
        );
    }

    return Client({
        merchantSerialNumber: env.VIPPS_MERCHANT_SERIAL_NUMBER,
        subscriptionKey: env.VIPPS_SUBSCRIPTION_KEY,
        useTestMode: env.VIPPS_TEST_MODE, // Set to false in production
    });
}

export interface CreatePaymentParams {
    amount: number; // Amount in minor units (øre)
    currency?: string;
    reference: string; // Unique reference for this payment (e.g., paymentId)
    userFlow: "WEB_REDIRECT" | "NATIVE_REDIRECT";
    returnUrl: string; // URL to redirect after payment
    description: string; // Payment description shown to user
    userPhoneNumber?: string;
}

const VIPPS_TOKEN_CACHE_KEY = "vipps:access_token";

/**
 * Decode JWT and get expiration timestamp
 */
function getJwtExpiration(token: string): number | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const payloadPart = parts[1];
        if (!payloadPart) return null;

        const payload = JSON.parse(
            Buffer.from(payloadPart, "base64").toString("utf-8"),
        );
        return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
    } catch {
        return null;
    }
}

/**
 * Get cached Vipps token or fetch a new one if expired
 */
async function getVippsToken(): Promise<string> {
    const vipps = getVippsClient();
    const redis = await getRedis();

    // Try to get cached token
    const cachedToken = await redis.get(VIPPS_TOKEN_CACHE_KEY);

    if (cachedToken) {
        const expiration = getJwtExpiration(cachedToken);

        // If token is valid and not expiring in the next 60 seconds, use it
        if (expiration && expiration > Date.now() + 60000) {
            return cachedToken;
        }
    }

    // Fetch new token
    const tokenResponse = await vipps.auth.getToken(
        env.VIPPS_CLIENT_ID || "",
        env.VIPPS_CLIENT_SECRET || "",
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `Failed to get Vipps token: ${tokenResponse.error instanceof Error ? tokenResponse.error.message : "Unknown error"}`,
        );
    }

    const token = tokenResponse.data.access_token;
    const expiration = getJwtExpiration(token);

    // Cache the token with appropriate TTL
    if (expiration) {
        const ttlSeconds = Math.floor((expiration - Date.now()) / 1000);
        if (ttlSeconds > 0) {
            await redis.setEx(VIPPS_TOKEN_CACHE_KEY, ttlSeconds, token);
        }
    }

    return token;
}

/**
 * Create a payment with Vipps
 * Returns the checkout URL where the user should be redirected
 */
export async function createPayment(
    params: CreatePaymentParams,
): Promise<string> {
    const token = await getVippsToken();
    const vipps = getVippsClient();

    const response = await vipps.payment.create(token, {
        amount: {
            currency: (params.currency || "NOK") as "NOK",
            value: params.amount,
        },
        paymentMethod: {
            type: "WALLET",
        },
        customer: params.userPhoneNumber
            ? {
                  phoneNumber: params.userPhoneNumber,
              }
            : undefined,
        reference: params.reference,
        userFlow: params.userFlow,
        returnUrl: params.returnUrl,
        paymentDescription: params.description,
    });

    if (!response.ok) {
        throw new Error(
            `Failed to create payment: ${response.error instanceof Error ? response.error.message : "title" in response.error ? response.error.title : "Unknown error"}`,
        );
    }

    if (!response.data.redirectUrl) {
        throw new Error("Failed to create payment: No redirect URL returned");
    }

    return response.data.redirectUrl;
}

/**
 * Get payment details from Vipps
 */
export async function getPaymentDetails(
    reference: string,
): Promise<GetPaymentResponse> {
    const token = await getVippsToken();
    const vipps = getVippsClient();

    const response = await vipps.payment.info(token, reference);

    if (!response.ok) {
        throw new Error(
            `Failed to get payment details: ${response.error instanceof Error ? response.error.message : "title" in response.error ? response.error.title : "Unknown error"}`,
        );
    }

    return response.data;
}

/**
 * Type of events we want to subscribe to
 *
 * Read more at https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/webhooks/
 */
const WEBHOOK_EVENTS = [
    "epayments.payment.created.v1",
    "epayments.payment.aborted.v1",
    "epayments.payment.expired.v1",
    "epayments.payment.cancelled.v1",
    "epayments.payment.captured.v1",
    "epayments.payment.refunded.v1",
    "epayments.payment.authorized.v1",
    "epayments.payment.terminated.v1",
];

const WEBHOOK_ID_CACHE_KEY = "vipps:webhook_id";
const WEBHOOK_SECRET_CACHE_KEY = "vipps:webhook_secret";
const WEBHOOK_API_PATH = "/api/event/payment/webhook";

export async function setupWebhooks(): Promise<{ id: string; secret: string }> {
    if (env.VIPPS_TEST_MODE) {
        return { id: "test", secret: "test" };
    }
    const vipps = getVippsClient();
    const vippsToken = await getVippsToken();

    // Check if we have webhook registration in redis
    const redis = await getRedis();
    const existingWebhookId = await redis.get(WEBHOOK_ID_CACHE_KEY);

    let hasRegisteredWebhook = false;

    // No registered webhook (saved locally)
    if (existingWebhookId) {
        if (!env.REFRESH_VIPPS_WEBHOOKS) {
            hasRegisteredWebhook = true;
        } else {
            const response = await vipps.webhook.list(vippsToken);

            if (!response.ok) {
                throw `Something went wrong while getting webhooks${response}`;
            }

            hasRegisteredWebhook = response.data.webhooks.some(
                (w) => w.id === existingWebhookId,
            );
        }
    }

    if (hasRegisteredWebhook) {
        const secret = await redis.get(WEBHOOK_SECRET_CACHE_KEY);
        if (!secret) {
            throw "Vipps webhook ID is present in redis, but not secret!";
        }

        if (!existingWebhookId) {
            throw "This should not happen. Logic above results in webhookId being set.";
        }

        return {
            id: existingWebhookId,
            secret,
        };
    }

    const response = await vipps.webhook.register(vippsToken, {
        events: WEBHOOK_EVENTS,
        // url: env.ROOT_URL + WEBHOOK_API_PATH,
        url: env.WEBHOOK_URL + WEBHOOK_API_PATH,
    });

    if (!response.ok) {
        throw `Something went wrong while creating webhook ${JSON.stringify(response, null, 2)}`;
    }

    const { id, secret } = response.data;

    redis.set(WEBHOOK_ID_CACHE_KEY, id);
    redis.set(WEBHOOK_SECRET_CACHE_KEY, secret);

    return {
        id,
        secret,
    };
}

/**
 * Gets the current webhook secret that should be used to validate webhooks from Vipps
 */
async function getWebhookSecret() {
    const redis = await getRedis();

    const secret = await redis.get(WEBHOOK_SECRET_CACHE_KEY);

    if (secret) {
        return secret;
    }

    const webhook = await setupWebhooks();
    return webhook.secret;
}

/**
 * The raw parts of an incoming request needed to verify a Vipps webhook.
 *
 * Vipps signs each callback with an HMAC-SHA256 signature over the request
 * method, path, host, date and a hash of the raw body. See
 * https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication/
 */
export interface VippsWebhookRequestParts {
    /** HTTP method, e.g. "POST". */
    method: string;
    /** Path and query string of the request, e.g. "/api/event/payment/webhook". */
    pathAndQuery: string;
    /** The `Host` header value the request was sent to. */
    host: string;
    /** The `x-ms-date` (or `date`) header value. */
    date: string;
    /** The `x-ms-content-sha256` header value (base64 SHA-256 of the body). */
    contentSha256: string;
    /** The `Authorization` header value. */
    authorization: string;
    /** The raw, unparsed request body. */
    rawBody: string;
}

/**
 * Constant-time comparison of two UTF-8 strings that never throws on length
 * mismatch (which `timingSafeEqual` would).
 */
function safeStringEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, "utf-8");
    const bufferB = Buffer.from(b, "utf-8");

    if (bufferA.length !== bufferB.length) {
        return false;
    }

    return timingSafeEqual(bufferA, bufferB);
}

/**
 * Extracts the `Signature` value from a Vipps `Authorization` header of the form
 * `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=<base64>`.
 */
function parseAuthorizationSignature(authorization: string): string | null {
    if (!authorization.startsWith("HMAC-SHA256 ")) {
        return null;
    }

    const match = authorization.match(/Signature=([^&\s]+)/);
    return match?.[1] ?? null;
}

/**
 * Verifies the authenticity of a Vipps webhook request from its raw parts.
 *
 * Recomputes the content hash and HMAC-SHA256 signature using the shared webhook
 * secret and compares them, in constant time, against the values Vipps sent.
 *
 * @returns `true` if the request is authentic, `false` otherwise.
 */
export function verifyVippsWebhookSignature(
    parts: VippsWebhookRequestParts,
    secret: string,
): boolean {
    const providedSignature = parseAuthorizationSignature(parts.authorization);

    if (!providedSignature || !parts.contentSha256 || !parts.date) {
        return false;
    }

    // Verify the body has not been tampered with: base64(sha256(rawBody)) must
    // match the x-ms-content-sha256 header.
    const computedContentHash = createHash("sha256")
        .update(parts.rawBody, "utf-8")
        .digest("base64");

    if (!safeStringEqual(computedContentHash, parts.contentSha256)) {
        return false;
    }

    // Rebuild the string Vipps signed and recompute the HMAC-SHA256 signature.
    const stringToSign = `${parts.method}\n${parts.pathAndQuery}\n${parts.date};${parts.host};${computedContentHash}`;

    const expectedSignature = createHmac("sha256", secret)
        .update(stringToSign, "utf-8")
        .digest("base64");

    return safeStringEqual(expectedSignature, providedSignature);
}

/**
 * Verifies an incoming Vipps webhook request from the Hono context.
 *
 * The raw body must be read (e.g. via `c.req.text()`) before parsing it as JSON,
 * because the body can only be consumed once and the raw bytes are required to
 * recompute the content hash.
 *
 * @returns `true` if the request is authentic, `false` otherwise.
 */
export async function verifyVippsWebhookRequest(
    c: Context,
    rawBody: string,
): Promise<boolean> {
    const secret = await getWebhookSecret();
    const url = new URL(c.req.url);

    return verifyVippsWebhookSignature(
        {
            method: c.req.method,
            pathAndQuery: url.pathname + url.search,
            host: c.req.header("host") ?? url.host,
            date: c.req.header("x-ms-date") ?? c.req.header("date") ?? "",
            contentSha256: c.req.header("x-ms-content-sha256") ?? "",
            authorization: c.req.header("authorization") ?? "",
            rawBody,
        },
        secret,
    );
}
