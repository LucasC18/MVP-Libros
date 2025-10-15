// src/db.js
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

/**
 * Conexión MSSQL (SQL Server) usando 'mssql' (driver tedious).
 * Variables .env:
 *  MSSQL_SERVER, MSSQL_PORT, MSSQL_DB, MSSQL_USER, MSSQL_PASS
 */
const config = {
  server: process.env.MSSQL_SERVER || "127.0.0.1",
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DB || "colegio",
  user: process.env.MSSQL_USER || "sa",
  password: process.env.MSSQL_PASS || "Admin123!",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

/**
 * Reemplaza '?' por @p0, @p1 ... y bindea automáticamente tipos básicos.
 */
function buildQuery(sqlText, params = []) {
  let idx = 0;
  const parsed = sqlText.replace(/\?/g, () => `@p${idx++}`);
  return { parsed };
}

function bindParams(request, params) {
  params.forEach((v, i) => {
    const name = `p${i}`;
    if (v === null || v === undefined) {
      request.input(name, sql.NVarChar, null);
    } else if (typeof v === "number" && Number.isInteger(v)) {
      request.input(name, sql.Int, v);
    } else if (typeof v === "number") {
      request.input(name, sql.Float, v);
    } else if (v instanceof Date) {
      request.input(name, sql.DateTime, v);
    } else {
      request.input(name, sql.NVarChar, String(v));
    }
  });
}

/**
 * Ejecuta consulta con parámetros tipo "?" y devuelve recordset.
 * Devuelve { recordset, rowsAffected } como 'mssql'.
 */
export async function query(sqlText, params = []) {
  await poolConnect;
  const request = pool.request();
  bindParams(request, params);
  const { parsed } = buildQuery(sqlText, params);
  const result = await request.query(parsed);
  return result;
}

export default { query };
