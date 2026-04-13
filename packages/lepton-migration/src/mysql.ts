/**
 * MySQL connection helper using mysql2/promise for async queries.
 */
import mysql from "mysql2/promise";

let connection: mysql.Connection;

export async function connectMySQL(url: string): Promise<mysql.Connection> {
    connection = await mysql.createConnection({
        uri: url,
        timezone: "+00:00",
        dateStrings: false,
    });
    console.log("Connected to MySQL (Lepton)");
    return connection;
}

export async function query<T = Record<string, unknown>>(
    sql: string,
): Promise<T[]> {
    const [rows] = await connection.query(sql);
    return rows as T[];
}

export async function closeMySQL(): Promise<void> {
    await connection.end();
    console.log("MySQL connection closed");
}
