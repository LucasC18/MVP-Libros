// src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db.js";

const router = Router();

/* ---------- LOGIN ADMIN ---------- */
router.post("/api/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Faltan credenciales" });

    const result = await db.query(
      "SELECT TOP 1 id, username, password_hash FROM admin_users WHERE username = ?",
      [username]
    );
    const rows = result.recordset;

    if (rows.length === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    req.session.user = { id: user.id, username: user.username };
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
});

/* ---------- SESIÓN ACTIVA ---------- */
router.get("/api/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "No autorizado" });
  res.json(req.session.user);
});

/* ---------- LOGOUT ---------- */
router.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
