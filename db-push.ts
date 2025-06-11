import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import 'dotenv/config';
import { existsSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const runMigration = async () => {
  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle(connection);

  console.log('Running migrations...');
  
  try {
    const migrationsFolder = './migrations';
    const journalPath = join(migrationsFolder, 'meta', '_journal.json');

    // Check if any tables exist
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
      );
    `);

    const tablesExist = result[0]?.exists;

    if (!tablesExist) {
      console.log('No tables found. Running initial migration...');
      await migrate(db, { migrationsFolder });
      console.log('Initial migration completed successfully');
    } else {
      console.log('Tables already exist. Skipping migration.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigration(); 