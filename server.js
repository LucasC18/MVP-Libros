// server.js
import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";

import appRouter from "./src/app.js";
import db from "./src/db.js"; // <-- Importá la conexión a la DB

dotenv.config();

const app = express();
const PORT = process.env.PORT || 13000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------- Middlewares globales --------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Seguridad básica
if (process.env.USE_HELMET === "true") {
  app.use(helmet());
}

// CORS + Sesión
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:13000",
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecreto",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

// Rutas principales
app.use(appRouter);

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

// 🔍 --- RUTA DE PRUEBA DE CONEXIÓN A LA BASE DE DATOS ---
app.get("/api/db-health", async (req, res) => {
  try {
    console.log("🔍 Intentando conectar a DB...");
    console.log("🔧 DATABASE_URL =", process.env.DATABASE_URL || "(undefined)");

    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY 1;
    `);

    res.json({ ok: true, tables: result.rows.map(x => x.table_name) });
  } catch (e) {
    // Log lo más detallado posible al servidor
    console.error("❌ Error real de conexión:", e);
    // Y devolvemos algo que se pueda leer en el navegador
    res
      .status(500)
      .json({ ok: false, error: e?.message || e?.code || JSON.stringify(e) });
  }
});


// Healthcheck base
app.get("/health", (req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

// Error handler global
app.use((err, req, res, next) => {
  console.error("❌", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Error interno del servidor" });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});

const ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Confía en el proxy de Render (necesario para cookies secure)
app.set('trust proxy', 1);

app.use(cors({
  origin(origin, cb) {
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Si frontend y API están en el MISMO dominio de Render → LAX
    sameSite: 'lax',
    // Si tu frontend está en OTRO dominio (por ej. GitHub Pages) usa:
    // sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

app.get('/api/db-health', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY 1;
    `);
    res.json({ ok: true, tables: r.rows.map(x => x.table_name) });
  } catch (e) {
    console.error('DB-HEALTH ERROR', e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const msg = err?.detail || err?.message || 'Error interno del servidor';
  console.error('❌', msg, err);
  res.status(status).json({ error: msg });
});

const PgStore = connectPgSimple(session);

app.use(
  session({
    store: new PgStore({
      // usa la misma DATABASE_URL que ya usás para Neon
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,   // crea la tabla "session" si no existe
      tableName: 'session'          // opcional, default "session"
    }),
    secret: process.env.SESSION_SECRET || "supersecreto",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,   // 8h
      secure: process.env.NODE_ENV === 'production',
    },
  })
);