import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create the connection
const connection = postgres(process.env.DATABASE_URL);
export const db = drizzle(connection, { schema });