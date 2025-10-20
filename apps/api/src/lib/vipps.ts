import { Client, type GetPaymentResponse } from "@vippsmobilepay/sdk";
import { getRedis } from "./cache/redis";
import { env } from "./env";

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

const client = Client({
    merchantSerialNumber: env.VIPPS_MERCHANT_SERIAL_NUMBER,
    subscriptionKey: env.VIPPS_SUBSCRIPTION_KEY,
    useTestMode: env.VIPPS_TEST_MODE, // Set to false in production
});

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
    const tokenResponse = await client.auth.getToken(
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

    const response = await client.payment.create(token, {
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

    const response = await client.payment.info(token, reference);

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
            const response = await client.webhook.list(vippsToken);

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

    const response = await client.webhook.register(vippsToken, {
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

export async function verifyVippsWebhookRequest() {}
