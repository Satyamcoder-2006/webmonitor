import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const runMigration = async () => {
  const connection = postgres(DATABASE_URL);
  const db = drizzle(connection);

  console.log('Running migrations...');
  
  try {
    const migrationsFolder = './migrations';
    console.log('Running fresh migration...');
    await migrate(db, { migrationsFolder });
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runMigration(); 