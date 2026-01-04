import { validator } from "hono-openapi";
import z from "zod";
import { schema } from "~/db";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

const createJobSchema = z
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
            // Validate that classStart <= classEnd
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

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["jobs"],
        summary: "Create job posting",
        operationId: "createJob",
        description:
            "Create a new job posting. Requires 'jobs:create' permission.",
    })
        .response(201, "Job posting created successfully")
        .badRequest("Invalid input")
        .build(),
    requireAuth,
    requirePermission("jobs:create"),
    validator("json", createJobSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const [newJob] = await db
            .insert(schema.jobPost)
            .values({
                ...body,
                deadline: body.deadline ? new Date(body.deadline) : null,
                jobType: body.jobType as schema.JobType,
                classStart: body.classStart as schema.UserClass,
                classEnd: body.classEnd as schema.UserClass,
                createdById: userId,
            })
            .returning();

        return c.json(newJob, 201);
    },
);
