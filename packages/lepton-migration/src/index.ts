import * as mysql from "mysql2";
import { createAppContext } from "photon/ctx";

const dump = async () => {
    const ctx = await createAppContext();
    const { auth } = ctx;

    // TODO use env vars
    const connection = mysql.createConnection({
        host: "localhost",
        port: 3306,
        user: "root",
        password: "rootpassword",
        database: "lepton",
    });

    connection.connect();

    connection.query(
        "SELECT * FROM authtoken_token JOIN `lepton`.content_user cu ON cu.user_id = authtoken_token.user_id",
        async (error, results, fields) => {
            const data = results as LeptonUserAccount[];

            console.log(error);

            console.log(data);

            // Create random 10 character password
            const password = Math.random().toString(36).slice(-10);

            for (const userAccount of data) {
                const user = await auth.api.createUser({
                    body: {
                        email: userAccount.email,
                        password,
                        name: `${userAccount.first_name} ${userAccount.last_name}`,
                        role: "user",
                        data: {
                            legacyToken: userAccount.key,
                            username: userAccount.user_id,
                        },
                    },
                });
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
