import { Client } from "@vippsmobilepay/sdk";
import { env } from "../env";

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

/**
 * Create a payment with Vipps
 * Returns the checkout URL where the user should be redirected
 */
export async function createPayment(
    params: CreatePaymentParams,
): Promise<string> {
    const tokenResponse = await client.auth.getToken(
        env.VIPPS_CLIENT_ID || "",
        env.VIPPS_CLIENT_SECRET || "",
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `Failed to get Vipps token: ${tokenResponse.error instanceof Error ? tokenResponse.error.message : "Unknown error"}`,
        );
    }

    const response = await client.payment.create(
        tokenResponse.data.access_token,
        {
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
    const tokenResponse = await client.auth.getToken(
        env.VIPPS_CLIENT_ID || "",
        env.VIPPS_CLIENT_SECRET || "",
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `Failed to get Vipps token: ${tokenResponse.error instanceof Error ? tokenResponse.error.message : "Unknown error"}`,
        );
    }

    const response = await client.payment.info(
        tokenResponse.data.access_token,
        reference,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to get payment details: ${response.error instanceof Error ? response.error.message : "title" in response.error ? response.error.title : "Unknown error"}`,
        );
    }

    return response.data as PaymentDetails;
}
