import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";

let db: any;
let pool: any;

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  pool = await mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  db = drizzle(pool, { schema, mode: "default" });

  console.log("✅ Database connected successfully");

  return db;
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!db) {
    // Return a proxy that will throw a clear error if used before initialization
    // This allows module-level imports to work
    return new Proxy({} as any, {
      get(target, prop) {
        if (db) return (db as any)[prop];
        throw new Error("Database not initialized. Call initializeDatabase() first.");
      },
    });
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log("Database connection closed");
  }
}
