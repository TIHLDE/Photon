import * as mysql from "mysql2";
import { createAuth } from "photon/auth";
import { createAppContext } from "photon/ctx";
import { schema, __db as db } from "photon/db";

const dump = async () => {
    const ctx = await createAppContext();
    const auth = createAuth(ctx);

    // TODO use env vars
    const connection = mysql.createConnection({
        host: "localhost",
        port: 3306,
        user: "root",
        password: "password",
        database: "nettside-dev",
    });

    connection.connect();

    connection.query(
        // TODO remove limit 1
        "SELECT * FROM authtoken_token JOIN `nettside-dev`.content_user cu ON cu.user_id = authtoken_token.user_id LIMIT 1",
        async (error, results, fields) => {
            const data = results as LeptonUserAccount[];

            console.log(data);

            // Create random 10 character password
            const password = Math.random().toString(36).slice(-10);

            for (const userAccount of data) {
                const user = await auth.api.createUser({
                    body: {
                        email: userAccount.email,
                        password,
                        name: `${userAccount.first_name} ${userAccount.last_name}`,
                        role: userAccount.is_superuser ? "admin" : "user", // better auth sdk stuff
                        data: {
                            legacyToken: userAccount.key,
                        },
                    },
                });

                if (userAccount.is_superuser) {
                    await db.insert(schema.userRole).values({
                        userId: user.user.id,
                        roleId: 1,
                    });
                }
            }
        },
    );

    connection.end();
};

dump();

interface LeptonUserAccount {
    key: string;
    created: Date;
    user_id: string;
    password: string;
    last_login: null;
    is_superuser: number;
    created_at: Date;
    updated_at: Date;
    image: null | string;
    first_name: string;
    last_name: string;
    email: string;
    gender: number;
    allergy: string;
    tool: string;
    is_staff: number;
    is_active: number;
    public_event_registrations: number;
    slack_user_id: string;
    accepts_event_rules: number;
    allows_photo_by_default: number;
}
