import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const addTestData = async () => {
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log('Adding test website...');
    await sql`
      INSERT INTO websites (url, name, email, check_interval, is_active, created_at, updated_at, last_status)
      VALUES (
        'https://example.com',
        'Example Website',
        'test@example.com',
        60,
        true,
        NOW(),
        NOW(),
        'unknown'
      );
    `;
    console.log('Test website added successfully');
  } catch (error) {
    console.error('Error adding test website:', error);
  } finally {
    await sql.end();
  }
};

addTestData(); 