import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { mapJobType, mapUserClass, batchInsert } from "../mappings";

interface LeptonJobPost {
    id: number;
    title: string;
    ingress: string;
    body: string;
    location: string;
    deadline: Date | null;
    company: string;
    email: string | null;
    link: string | null;
    is_continuously_hiring: number;
    class_start: number;
    class_end: number;
    job_type: string;
    image: string | null;
    image_alt: string | null;
    created_at: Date;
    updated_at: Date;
}

export async function migrateJobs(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 13: Job Posts ===");

    const jobs = await query<LeptonJobPost>("SELECT * FROM career_jobpost");
    console.log(`  Found ${jobs.length} job posts`);

    const records = jobs.map((j) => ({
        id: crypto.randomUUID(),
        title: j.title.slice(0, 200),
        ingress: (j.ingress || "").slice(0, 800),
        body: j.body || "",
        company: j.company.slice(0, 200),
        location: j.location.slice(0, 200),
        deadline: j.deadline,
        isContinuouslyHiring: Boolean(j.is_continuously_hiring),
        jobType: mapJobType(j.job_type),
        email: j.email?.slice(0, 320) ?? null,
        link: j.link ?? null,
        classStart: mapUserClass(j.class_start),
        classEnd: mapUserClass(j.class_end),
        imageUrl: j.image ?? null,
        imageAlt: j.image_alt?.slice(0, 255) ?? null,
        createdById: null,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
    }));

    await batchInsert(records, 500, async (batch) => {
        await db.insert(schema.jobPost).values(batch).onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} job posts`);
    console.log("  Phase 13 complete");
}
