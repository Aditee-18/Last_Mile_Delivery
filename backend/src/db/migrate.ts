import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const targetDbName = process.env.DB_NAME || 'last_mile_delivery';

async function ensureDatabaseExists() {
  console.log(`🔍 Checking if database "${targetDbName}" exists...`);
  
  // Connect to default 'postgres' system database first
  const defaultPool = new Pool({
    connectionString: `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/postgres`,
  });

  try {
    const res = await defaultPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1;`,
      [targetDbName]
    );

    if (res.rowCount === 0) {
      console.log(`⚙️ Database "${targetDbName}" does not exist. Creating it now...`);
      // Note: CREATE DATABASE cannot run inside a transaction block
      await defaultPool.query(`CREATE DATABASE "${targetDbName}";`);
      console.log(`✨ Database "${targetDbName}" created successfully!`);
    } else {
      console.log(`✅ Database "${targetDbName}" already exists.`);
    }
  } catch (error: any) {
    console.error('⚠️ Could not auto-create database (check PostgreSQL password in .env):', error.message);
  } finally {
    await defaultPool.end();
  }
}

async function runMigration() {
  console.log('🔄 Starting Database Migration...');
  
  // 1. Ensure target database exists
  await ensureDatabaseExists();

  // 2. Connect to the target database
  const targetPool = new Pool({
    connectionString: `postgres://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${targetDbName}`,
  });

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`🚀 Executing PostGIS Schema on "${targetDbName}"...`);
    await targetPool.query(sql);
    console.log('🎉 Database Schema & PostGIS Extensions created successfully!');
  } catch (error) {
    console.error('❌ Migration Error:', error);
  } finally {
    await targetPool.end();
  }
}

runMigration();
