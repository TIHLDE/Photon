import z from "zod";
import { Schema } from "~/lib/openapi";

/**
 * Event formats a company can express interest in. Kept as a free-form string
 * list rather than an enum — Næringsliv og kurs adjusts the offering between
 * semesters, and the value is only ever rendered into an email.
 */
export const COMPANY_CONTACT_EVENT_TYPES = [
    "Bedriftspresentasjon",
    "Kurs/Workshop",
    "Bedriftsbesøk",
    "Annonse",
    "Insta-takeover",
    "Bedriftsekskursjon",
    "Annet",
] as const;

// ===== INPUT SCHEMAS =====

export const companyContactSchema = Schema(
    "CompanyContact",
    z.object({
        company: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Name of the company reaching out" }),
        contactName: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Name of the person to reply to" }),
        contactEmail: z
            .email()
            .max(320)
            .meta({ description: "Email address to reply to" }),
        eventTypes: z.array(z.string().min(1).max(100)).min(1).max(20).meta({
            description: "Event formats the company is interested in",
        }),
        semesters: z
            .array(z.string().min(1).max(100))
            .min(1)
            .max(20)
            .meta({ description: "Semesters the company is available in" }),
        comment: z
            .string()
            .max(5000)
            .default("")
            .meta({ description: "Free-text message from the company" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const companyContactResponseSchema = Schema(
    "CompanyContactResponse",
    z.object({
        success: z.boolean(),
        message: z.string(),
    }),
);
