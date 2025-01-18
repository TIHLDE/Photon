import { env } from '@/env';
import pg from 'pg';

const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

async function waitForPostgres() {
    for (let i = 0; i < MAX_RETRIES; i++) {
        const client = new pg.Client({
            connectionString: env.DATABASE_URL,
        });

        try {
            await client.connect();
            console.log('Successfully connected to Postgres');
            await client.end();
            process.exit(0);
        } catch (err) {
            console.error(`Attempt ${i + 1}/${MAX_RETRIES}: Waiting for Postgres...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }

    console.error('Failed to connect to Postgres after maximum retries');
    process.exit(1);
}

waitForPostgres();