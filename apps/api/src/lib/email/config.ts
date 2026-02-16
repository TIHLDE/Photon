/**
 * Email configuration constants
 */

/**
 * Rate limit for sending emails (in milliseconds)
 * Emails will be sent at a rate of one email every 3 seconds
 */
export const EMAIL_SEND_RATE_MS = 3000;

/**
 * Name of the email queue in BullMQ
 */
export const EMAIL_QUEUE_NAME = "email" as const;
