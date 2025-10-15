// server.js
import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";

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
