import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createJobSchema, jobDetailSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["jobs"],
        summary: "Create job posting",
        operationId: "createJob",
        description:
            "Create a new job posting. Requires 'jobs:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: jobDetailSchema,
            description: "Job posting created successfully",
        })
        .badRequest({ description: "Invalid input" })
        .build(),
    requireAuth,
    requireAccess({ permission: "jobs:create" }),
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
