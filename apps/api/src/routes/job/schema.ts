import { schema } from "@photon/db";
import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
} from "~/middleware/pagination";

// ===== INPUT SCHEMAS =====

export const createJobSchema = z
    .object({
        title: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Job posting title" }),
        ingress: z
            .string()
            .max(800)
            .default("")
            .meta({ description: "Short description/summary" }),
        body: z
            .string()
            .default("")
            .meta({ description: "Full job description" }),
        company: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Company name" }),
        location: z
            .string()
            .min(1)
            .max(200)
            .meta({ description: "Job location" }),
        deadline: z
            .string()
            .datetime()
            .optional()
            .meta({ description: "Application deadline" }),
        isContinuouslyHiring: z
            .boolean()
            .default(false)
            .meta({ description: "Whether hiring is ongoing" }),
        jobType: z
            .enum(["full_time", "part_time", "summer_job", "other"])
            .default("other")
            .meta({ description: "Type of employment" }),
        email: z
            .string()
            .email()
            .max(320)
            .optional()
            .meta({ description: "Contact email" }),
        link: z
            .string()
            .url()
            .optional()
            .meta({ description: "Application or company URL" }),
        classStart: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .default("first")
            .meta({ description: "Target class start" }),
        classEnd: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .default("fifth")
            .meta({ description: "Target class end" }),
        imageUrl: z
            .string()
            .url()
            .optional()
            .meta({ description: "Company logo" }),
        imageAlt: z
            .string()
            .max(255)
            .optional()
            .meta({ description: "Logo alt text" }),
    })
    .refine(
        (data) => {
            const classOrder = [
                "first",
                "second",
                "third",
                "fourth",
                "fifth",
                "alumni",
            ];
            return (
                classOrder.indexOf(data.classStart) <=
                classOrder.indexOf(data.classEnd)
            );
        },
        {
            message: "classStart must be less than or equal to classEnd",
            path: ["classStart"],
        },
    );

export const updateJobSchema = z
    .object({
        title: z.string().min(1).max(200).optional(),
        ingress: z.string().max(800).optional(),
        body: z.string().optional(),
        company: z.string().min(1).max(200).optional(),
        location: z.string().min(1).max(200).optional(),
        deadline: z.string().datetime().optional().nullable(),
        isContinuouslyHiring: z.boolean().optional(),
        jobType: z
            .enum(["full_time", "part_time", "summer_job", "other"])
            .optional(),
        email: z.string().email().max(320).optional().nullable(),
        link: z.url().optional().nullable(),
        classStart: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        classEnd: z
            .enum(["first", "second", "third", "fourth", "fifth", "alumni"])
            .optional(),
        imageUrl: z.url().optional().nullable(),
        imageAlt: z.string().max(255).optional().nullable(),
    })
    .refine(
        (data) => {
            if (data.classStart && data.classEnd) {
                const classOrder = [
                    "first",
                    "second",
                    "third",
                    "fourth",
                    "fifth",
                    "alumni",
                ];
                return (
                    classOrder.indexOf(data.classStart) <=
                    classOrder.indexOf(data.classEnd)
                );
            }
            return true;
        },
        {
            message: "classStart must be less than or equal to classEnd",
            path: ["classStart"],
        },
    );

export const jobListFilterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter by title or company name",
    }),
    expired: z.coerce.boolean().optional().meta({
        description: "Include expired job postings (default: false)",
    }),
    jobType: z.enum(schema.jobTypeVariants).optional().meta({
        description: "Filter by job type",
    }),
    year: z.enum(schema.userClassVariants).optional().meta({
        description:
            "Filter by year of study (returns jobs targeting that class)",
    }),
});

// ===== SHARED JOB FIELDS =====

const jobFields = z.object({
    id: z.uuid().meta({ description: "Job posting ID" }),
    title: z.string().meta({ description: "Job title" }),
    ingress: z.string().meta({ description: "Short description" }),
    body: z.string().meta({ description: "Full job description" }),
    company: z.string().meta({ description: "Company name" }),
    location: z.string().meta({ description: "Job location" }),
    deadline: z
        .string()
        .nullable()
        .meta({ description: "Application deadline (ISO 8601)" }),
    isContinuouslyHiring: z
        .boolean()
        .meta({ description: "Is continuously hiring" }),
    jobType: z.enum(schema.jobTypeVariants).meta({ description: "Job type" }),
    email: z.string().nullable().meta({ description: "Contact email" }),
    link: z.string().nullable().meta({ description: "Application link" }),
    classStart: z
        .enum(schema.userClassVariants)
        .meta({ description: "Minimum year of study" }),
    classEnd: z
        .enum(schema.userClassVariants)
        .meta({ description: "Maximum year of study" }),
    imageUrl: z.string().nullable().meta({ description: "Image URL" }),
    imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
    createdById: z.string().nullable().meta({ description: "Creator user ID" }),
    createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.string().meta({ description: "Last update time (ISO 8601)" }),
});

// ===== RESPONSE SCHEMAS =====

export const jobDetailSchema = Schema(
    "JobDetail",
    jobFields.extend({
        creator: z
            .object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
            })
            .nullable()
            .meta({ description: "Creator user info" }),
        expired: z
            .boolean()
            .meta({ description: "Whether the job posting has expired" }),
    }),
);

export const jobListItemSchema = Schema(
    "JobListItem",
    jobFields.extend({
        expired: z
            .boolean()
            .meta({ description: "Whether the job posting has expired" }),
    }),
);

export const jobListResponseSchema = Schema(
    "JobList",
    PagniationResponseSchema.extend({
        items: z.array(jobListItemSchema).describe("List of job postings"),
    }),
);

export const deleteJobResponseSchema = Schema(
    "DeleteJobResponse",
    z.object({
        message: z.string(),
    }),
);
