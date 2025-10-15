// server.js
import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";

import appRouter from "./src/app.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 13000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -------- Middlewares globales --------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Seguridad básica (opcional por .env)
if ((process.env.USE_HELMET || "false").toLowerCase() === "true") {
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

// Rutas API
app.use(appRouter);

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

// Healthcheck
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
