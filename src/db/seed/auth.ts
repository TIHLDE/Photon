import { eq } from "drizzle-orm";
import { schema } from "..";
import type { AppContext } from "../../lib/ctx";

/**
 * Seed auth-related tables (user, session, account, verification)
 */
export default async ({ db, auth }: AppContext) => {
    // Create test user if it doesn't exist
    const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, "test@test.com"))
        .limit(1);

    if (!users.length) {
        const user = await auth.api.createUser({
            body: {
                email: "test@test.com",
                password: "index123",
                name: "Brotherman Testern",
                role: "admin",
            },
        });

        const userId = user.user.id;

        await db
            .update(schema.user)
            .set({ emailVerified: true })
            .where(eq(schema.user.id, userId));

        await db.insert(schema.userSettings).values({
            userId,
            acceptsEventRules: true,
            allowsPhotosByDefault: true,
            gender: "male",
            receiveMailCommunication: true,
            bioDescription: "I am a test user created during seeding.",
            createdAt: new Date(),
            updatedAt: new Date(),
            isOnboarded: true,
        });
    }
};
