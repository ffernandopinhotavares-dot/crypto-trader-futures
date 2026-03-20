import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";

let db: any;
let client: any;

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === "production" ? "require" : undefined,
  });

  db = drizzle(client, { schema });

  // Test connection
  await client`SELECT 1`;

  console.log("✅ Database connected successfully");

  return db;
}

/**
 * Get database instance
 */
export function getDatabase() {
  if (!db) {
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
  if (client) {
    await client.end();
    console.log("Database connection closed");
  }
}
