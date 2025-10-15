// src/db.js
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // en Render: añade esto en Environment
  ssl: { rejectUnauthorized: false },         // Neon/Render
});

export async function query(text, params = []) {
  const res = await pool.query(text, params);
  // normaliza a .rows
  return { rows: res.rows, rowCount: res.rowCount };
}

export default { query, engine: "pg" };
