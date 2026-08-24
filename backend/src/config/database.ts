import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const dbName = process.env.DB_NAME || 'last_mile_delivery';

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL Pool Error:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] duration: ${duration}ms | rows: ${res.rowCount}`);
  }
  return { rows: res.rows, rowCount: res.rowCount };
}

export async function testDbConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT NOW() as now, PostGIS_Full_Version() as postgis;');
    console.log('✅ PostgreSQL connected successfully at:', res.rows[0].now);
    console.log('🌐 PostGIS Version:', res.rows[0].postgis);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL Connection Failed:', error);
    return false;
  }
}
