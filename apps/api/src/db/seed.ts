import { seed } from "drizzle-seed";
import * as schema from "../db/schema";
import {
    permission as permissionTable,
    role as roleTable,
    rolePermission as rolePermissionTable,
} from "../db/schema";

import db from ".";

export default async () => {
    // Check if any users exist
    const studyGroupCount = await db
        .select()
        .from(schema.studyProgram)
        .limit(1)
        .then((rows) => rows.length);

    const firstRun = studyGroupCount === 0;
    // await seed(db, schema, { count: 10 });

    if (firstRun) {
        await db.insert(schema.studyProgram).values([
            {
                displayName: "Dataingeniør",
                feideCode: "BIDATA",
                slug: "dataingenir",
                type: "bachelor",
            },
            {
                displayName: "Digital Forretningsutvikling",
                feideCode: "ITBAITBEDR",
                slug: "digital-forretningsutvikling",
                type: "bachelor",
            },
            {
                displayName: "Digital Infrastruktur og Cybersikkerhet",
                feideCode: "BDIGSEC",
                slug: "digital-infrastruktur-og-cybersikkerhet",
                type: "bachelor",
            },
            {
                displayName: "Digital Samhandling",
                feideCode: "ITMAIKTSA",
                slug: "digital-samhandling",
                type: "master",
            },
            {
                displayName: "Drift",
                feideCode: "ITBAINFODR",
                slug: "drift-studie",
                type: "bachelor",
            },
            {
                displayName: "Informasjonsbehandling",
                feideCode: "ITBAINFO",
                slug: "informasjonsbehandling",
                type: "bachelor",
            },
        ]);
    }

    // Seed RBAC defaults
    const [adminRole] = await db
        .insert(roleTable)
        .values({ name: "admin", description: "Administrator", position: 1 })
        .onConflictDoNothing()
        .returning();
    const [eventsCreate] = await db
        .insert(permissionTable)
        .values({ name: "events:create", description: "Create events" })
        .onConflictDoNothing()
        .returning();
    const [eventsUpdate] = await db
        .insert(permissionTable)
        .values({ name: "events:update", description: "Update events" })
        .onConflictDoNothing()
        .returning();
    const [eventsDelete] = await db
        .insert(permissionTable)
        .values({ name: "events:delete", description: "Delete events" })
        .onConflictDoNothing()
        .returning();
    if (adminRole) {
        for (const p of [eventsCreate, eventsUpdate, eventsDelete]) {
            if (!p) continue;
            await db
                .insert(rolePermissionTable)
                .values({ roleId: adminRole.id, permissionId: p.id })
                .onConflictDoNothing();
        }
    }

    console.log("🌱 Successfully seeded the database");
};
