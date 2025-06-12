import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    // Add custom_tags column
    await pool.query(`
      ALTER TABLE "websites" 
      ADD COLUMN IF NOT EXISTS "custom_tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
      ADD COLUMN IF NOT EXISTS "ssl_valid" boolean,
      ADD COLUMN IF NOT EXISTS "ssl_expiry_date" timestamp,
      ADD COLUMN IF NOT EXISTS "ssl_days_left" integer;
    `);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate(); 