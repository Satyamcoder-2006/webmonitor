import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const dropAll = async () => {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('Dropping public schema...');
    await sql`DROP SCHEMA public CASCADE;`;
    await sql`CREATE SCHEMA public;`;
    console.log('Schema dropped and recreated successfully');
  } catch (error) {
    console.error('Error dropping schema:', error);
  } finally {
    await sql.end();
  }
};

dropAll();