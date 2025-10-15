// src/db.js
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

/**
 * Usa Postgres (Neon u otro). Requiere DATABASE_URL en el .env
 * Ejemplo:
 * DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

export async function query(sqlText, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sqlText, params);
    return { recordset: res.rows, rowsAffected: [res.rowCount] };
  } finally {
    client.release();
  }
}

export default { query };
