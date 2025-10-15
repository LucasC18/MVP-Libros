// src/routes/books.routes.js
import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const isValidEstado = (v) => ["disponible", "prestado", "baja"].includes(v);
const now = () => new Date();

function sanitizeBook(body, { partial = false } = {}) {
  const b = {};
  const setIf = (k, v) => {
    if (v !== undefined && v !== null && v !== "") b[k] = v;
  };

  setIf("isbn", body.isbn?.toString().trim());
  setIf("titulo", body.titulo?.toString().trim());
  setIf("autor", body.autor?.toString().trim());
  setIf("editorial", body.editorial?.toString().trim());
  if (body.anio !== undefined) b.anio = Number(body.anio);
  setIf("categoria", body.categoria?.toString().trim());
  setIf("ubicacion", body.ubicacion?.toString().trim());
  if (body.stock !== undefined) b.stock = Number(body.stock);
  if (body.precio !== undefined) b.precio = Number(body.precio);
  setIf("estado", body.estado?.toString().trim());
  setIf("notas", body.notas?.toString().trim());

  const currentYear = new Date().getFullYear() + 1;
  const errors = [];
  const need = (k) => {
    if (!partial && (b[k] === undefined || b[k] === "")) {
      errors.push(`Campo requerido: ${k}`);
    }
  };

  need("titulo");
  need("autor");

  if (b.stock !== undefined && b.stock < 0) errors.push("stock ≥ 0");
  if (b.precio !== undefined && b.precio < 0) errors.push("precio ≥ 0");
  if (b.anio !== undefined && (b.anio < 1800 || b.anio > currentYear)) {
    errors.push(`anio entre 1800 y ${currentYear}`);
  }
  if (b.estado !== undefined && !isValidEstado(b.estado)) {
    errors.push(`estado inválido (disponible|prestado|baja)`);
  }

  return { b, errors };
}

/** GET /api/libros?search=&page=&limit=&sortBy=&sortDir= */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const sortBy = ["created_at", "titulo", "autor", "anio", "precio", "stock"].includes(
      req.query.sortBy
    )
      ? req.query.sortBy
      : "created_at";
    const sortDir = req.query.sortDir === "asc" ? "ASC" : "DESC";

    const like = `%${search}%`;
    const whereParts = [`estado <> 'baja'`]; // 👈 no mostramos los dados de baja
    const params = [];

    if (search) {
      whereParts.push(`(titulo LIKE ? OR autor LIKE ? OR categoria LIKE ?)`);
      params.push(like, like, like);
    }

    const where = whereParts.length ? "WHERE " + whereParts.join(" AND ") : "";

    const totalRes = await db.query(
      `SELECT COUNT(*) AS total FROM books ${where}`,
      params
    );
    const total = totalRes.recordset[0]?.total || 0;

    const rowsRes = await db.query(
      `
      SELECT *
      FROM books
      ${where}
      ORDER BY ${sortBy} ${sortDir}
      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
      `,
      [...params, offset, limit]
    );
    const rows = rowsRes.recordset;

    res.json({
      data: rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/libros/:id */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM books WHERE id = ?", [id]);
    const rows = result.recordset;
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/** POST /api/libros */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ error: errors.join(", ") });

    b.created_at = now();
    b.updated_at = now();
    if (!b.estado) b.estado = "disponible";

    const ins = await db.query(
      `
      INSERT INTO books (isbn, titulo, autor, editorial, anio, categoria, ubicacion, stock, precio, estado, notas, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        b.isbn || null,
        b.titulo,
        b.autor,
        b.editorial || null,
        b.anio || null,
        b.categoria || null,
        b.ubicacion || null,
        b.stock || 0,
        b.precio || 0,
        b.estado,
        b.notas || null,
        b.created_at,
        b.updated_at,
      ]
    );
    const created = ins.recordset[0];
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/libros/:id  (update total) */
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { b, errors } = sanitizeBook(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ error: errors.join(", ") });

    b.updated_at = now();

    const upd = await db.query(
      `
      UPDATE books SET
        isbn = ?, titulo = ?, autor = ?, editorial = ?, anio = ?, categoria = ?, ubicacion = ?,
        stock = ?, precio = ?, estado = ?, notas = ?, updated_at = ?
      OUTPUT INSERTED.*
      WHERE id = ?
      `,
      [
        b.isbn || null,
        b.titulo,
        b.autor,
        b.editorial || null,
        b.anio || null,
        b.categoria || null,
        b.ubicacion || null,
        b.stock || 0,
        b.precio || 0,
        b.estado || "disponible",
        b.notas || null,
        b.updated_at,
        id,
      ]
    );

    const updated = upd.recordset[0];
    if (!updated) return res.status(404).json({ error: "No encontrado" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/libros/:id  (update parcial) */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { b, errors } = sanitizeBook(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(", ") });
    if (Object.keys(b).length === 0) return res.status(400).json({ error: "Sin cambios" });

    // NO guardes updated_at dentro de 'b' para que no se duplique en el SET
    const fields = Object.keys(b).filter(k => k !== 'updated_at'); // por si viniera del cliente
    const values = fields.map(k => b[k]);

    // agregamos updated_at una única vez al final
    const setSql = [...fields.map(k => `${k} = ?`), 'updated_at = ?'].join(', ');
    const params = [...values, new Date(), id];

    const upd = await db.query(
      `
      UPDATE books
      SET ${setSql}
      OUTPUT INSERTED.*
      WHERE id = ?
      `,
      params
    );

    const updated = upd.recordset[0];
    if (!updated) return res.status(404).json({ error: "No encontrado" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});


/** DELETE /api/libros/:id  (borrado lógico) */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const upd = await db.query(
      "UPDATE books SET estado = 'baja', updated_at = ? OUTPUT INSERTED.id WHERE id = ?",
      [now(), id]
    );
    const ok = upd.recordset[0];
    if (!ok) return res.status(404).json({ error: "No encontrado" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
