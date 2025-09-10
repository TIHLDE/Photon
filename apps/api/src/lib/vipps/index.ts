import { Client } from "@vippsmobilepay/sdk";
import { env } from "../env";

if (!env.VIPPS_MERCHANT_SERIAL_NUMBER || !env.VIPPS_SUBSCRIPTION_KEY) {
    throw new Error(
        "Vipps is not configured properly. Please set VIPPS_MERCHANT_SERIAL_NUMBER and VIPPS_SUBSCRIPTION_KEY in your environment variables.",
    );
}

const client = Client({
    merchantSerialNumber: env.VIPPS_MERCHANT_SERIAL_NUMBER,
    subscriptionKey: env.VIPPS_SUBSCRIPTION_KEY,
});
