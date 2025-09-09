import { seed } from "drizzle-seed";
import * as schema from "../db/schema";
import {
    permission as permissionTable,
    role as roleTable,
    rolePermission as rolePermissionTable,
} from "../db/schema";

import db from ".";
import { auth } from "../lib/auth";

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
    const [eventsRegistrationsList] = await db
        .insert(permissionTable)
        .values({
            name: "events:registrations:list",
            description: "List event registrations",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsCheckin] = await db
        .insert(permissionTable)
        .values({
            name: "events:registrations:checkin",
            description: "Check-in users to events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackList] = await db
        .insert(permissionTable)
        .values({
            name: "events:feedback:list",
            description: "List feedback for events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsList] = await db
        .insert(permissionTable)
        .values({
            name: "events:payments:list",
            description: "List payments for events",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsCreate] = await db
        .insert(permissionTable)
        .values({
            name: "events:payments:create",
            description: "Create event payment records",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsGet] = await db
        .insert(permissionTable)
        .values({
            name: "events:payments:get",
            description: "Get a single payment",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsUpdate] = await db
        .insert(permissionTable)
        .values({
            name: "events:payments:update",
            description: "Update a payment record",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsPaymentsDelete] = await db
        .insert(permissionTable)
        .values({
            name: "events:payments:delete",
            description: "Delete a payment record",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsGet] = await db
        .insert(permissionTable)
        .values({
            name: "events:registrations:get",
            description: "Get a single registration",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsCreate] = await db
        .insert(permissionTable)
        .values({
            name: "events:registrations:create",
            description: "Admin create registration for a user",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsRegistrationsDelete] = await db
        .insert(permissionTable)
        .values({
            name: "events:registrations:delete",
            description: "Admin delete registration",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackGet] = await db
        .insert(permissionTable)
        .values({
            name: "events:feedback:get",
            description: "Get a single feedback",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackUpdate] = await db
        .insert(permissionTable)
        .values({
            name: "events:feedback:update",
            description: "Update feedback",
        })
        .onConflictDoNothing()
        .returning();
    const [eventsFeedbackDelete] = await db
        .insert(permissionTable)
        .values({
            name: "events:feedback:delete",
            description: "Delete feedback",
        })
        .onConflictDoNothing()
        .returning();
    if (adminRole) {
        for (const p of [
            eventsCreate,
            eventsUpdate,
            eventsDelete,
            eventsRegistrationsList,
            eventsRegistrationsCheckin,
            eventsRegistrationsGet,
            eventsRegistrationsCreate,
            eventsRegistrationsDelete,
            eventsFeedbackList,
            eventsFeedbackGet,
            eventsFeedbackUpdate,
            eventsFeedbackDelete,
            eventsPaymentsList,
            eventsPaymentsCreate,
            eventsPaymentsGet,
            eventsPaymentsUpdate,
            eventsPaymentsDelete,
        ]) {
            if (!p) continue;
            await db
                .insert(rolePermissionTable)
                .values({ roleId: adminRole.id, permissionId: p.id })
                .onConflictDoNothing();
        }
    }

    await auth.api.createUser({
        body: {
            email: "test@test.com",
            password: "index123",
            name: "Brotherman Testern",
            role: "admin",
        },
    });

    console.log("🌱 Successfully seeded the database");
};
