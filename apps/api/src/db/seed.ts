import { seed } from "drizzle-seed";
import * as schema from "../db/schema";

import db from ".";
import { auth } from "../lib/auth";

export default async () => {
    // Check if any users exist
    const studyGroupCount = await db
        .select()
        .from(schema.studyProgram)
        .limit(1)
        .then((rows) => rows.length);

    if (studyGroupCount > 0) {
        console.log("🌱 Already seeded");
        return;
    }
    // await seed(db, schema, { count: 10 });

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
