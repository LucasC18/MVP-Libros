// src/db.js
import dotenv from 'dotenv';
dotenv.config();

const ENGINE = (process.env.DB_ENGINE || '').toLowerCase();

let db;

if (ENGINE === 'pg') {
  // ---------- Postgres (Neon) ----------
  import('pg').then(({ default: pg }) => {
    const { Pool } = pg;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Reemplaza ? -> $1, $2...
    function toPg(sqlText) {
      let i = 0;
      return sqlText.replace(/\?/g, () => `$${++i}`);
    }

    db = {
      engine: 'pg',
      async query(sqlText, params = []) {
        const parsed = toPg(sqlText);
        const res = await pool.query(parsed, params);
        // normalizamos para parecer a mssql:
        return {
          recordset: res.rows,
          rowsAffected: [res.rowCount ?? 0],
        };
      },
    };
  });
} else {
  // ---------- SQL Server (mssql) ----------
  import('mssql').then(({ default: sql }) => {
    const config = {
      server: process.env.MSSQL_SERVER || '127.0.0.1',
      port: Number(process.env.MSSQL_PORT || 1433),
      database: process.env.MSSQL_DB || 'colegio',
      user: process.env.MSSQL_USER || 'sa',
      password: process.env.MSSQL_PASS || 'Admin123!',
      options: { encrypt: false, trustServerCertificate: true },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };

    const pool = new sql.ConnectionPool(config);
    const poolConnect = pool.connect();

    function toMssql(sqlText) {
      let i = 0;
      return sqlText.replace(/\?/g, () => `@p${i++}`);
    }

    function bindParams(request, params) {
      params.forEach((v, i) => {
        const name = `p${i}`;
        if (v === null || v === undefined) request.input(name, sql.NVarChar, null);
        else if (typeof v === 'number' && Number.isInteger(v)) request.input(name, sql.Int, v);
        else if (typeof v === 'number') request.input(name, sql.Float, v);
        else if (v instanceof Date) request.input(name, sql.DateTime, v);
        else request.input(name, sql.NVarChar, String(v));
      });
    }

    db = {
      engine: 'mssql',
      async query(sqlText, params = []) {
        await poolConnect;
        const req = pool.request();
        bindParams(req, params);
        const parsed = toMssql(sqlText);
        const result = await req.query(parsed);
        return result; // { recordset, rowsAffected, ... }
      },
    };
  });
}

// Pequeño wrapper para esperar carga dinámica (import)
export default {
  get engine() {
    return db?.engine;
  },
  async query(sqlText, params = []) {
    // esperamos a que el import dinámico termine
    while (!db) {
      await new Promise(r => setTimeout(r, 5));
    }
    return db.query(sqlText, params);
  },
};
