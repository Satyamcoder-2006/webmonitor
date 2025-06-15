import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

// Extract database name from connection string
const dbName = 'webwatchtower';
const baseUrl = DATABASE_URL.replace(/\/[^/]+$/, '');

const createDatabase = async () => {
  // Connect to postgres database to create new database
  const sql = postgres(baseUrl + '/postgres');
  
  try {
    console.log('Creating database...');
    await sql`CREATE DATABASE ${sql(dbName)}`;
    console.log('Database created successfully');
  } catch (error: any) {
    if (error.code === '42P04') {
      console.log('Database already exists');
    } else {
      console.error('Error creating database:', error);
    }
  } finally {
    await sql.end();
  }
};

createDatabase(); 