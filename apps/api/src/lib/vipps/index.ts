import { Client } from "@vippsmobilepay/sdk";
import { env } from "../env";
import { getRedis } from "../cache/redis";

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
    useTestMode: true, // Set to false in production
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

export interface PaymentDetails {
    reference: string;
    state: "CREATED" | "AUTHORIZED" | "TERMINATED" | "ABORTED";
    amount: {
        value: number;
        currency: string;
    };
    aggregate: {
        authorizedAmount: {
            value: number;
            currency: string;
        };
        capturedAmount: {
            value: number;
            currency: string;
        };
        refundedAmount: {
            value: number;
            currency: string;
        };
        cancelledAmount: {
            value: number;
            currency: string;
        };
    };
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
        },
    );

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
): Promise<PaymentDetails> {
    const token = await getVippsToken();

    const response = await client.payment.info(token, reference);

    if (!response.ok) {
        throw new Error(
            `Failed to get payment details: ${response.error instanceof Error ? response.error.message : "title" in response.error ? response.error.title : "Unknown error"}`,
        );
    }

    return response.data as PaymentDetails;
}
