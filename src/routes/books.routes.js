// src/routes/books.routes.js
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper: tomar filas del resultado sin importar el driver
const rowsOf = (r) => r?.rows || r?.recordset || [];

// Estados válidos
const isValidEstado = (v) => ['disponible', 'prestado', 'baja'].includes(v);

// -------- Sanitizador / validador --------
function sanitizeBook(body, { partial = false } = {}) {
  const b = {};
  const setIf = (k, v) => {
    if (v !== undefined && v !== null && v !== '') b[k] = v;
  };

  setIf('titulo', body.titulo?.toString().trim());
  setIf('autor', body.autor?.toString().trim());
  setIf('editorial', body.editorial?.toString().trim());
  if (body.anio !== undefined) b.anio = Number(body.anio);
  setIf('categoria', body.categoria?.toString().trim());
  setIf('ubicacion', body.ubicacion?.toString().trim());
  if (body.stock !== undefined) b.stock = Number(body.stock);
  if (body.precio !== undefined) b.precio = Number(body.precio);
  setIf('estado', body.estado?.toString().trim());
  setIf('notas', body.notas?.toString().trim());

  const currentYear = new Date().getFullYear() + 1;
  const errors = [];

  const need = (k) => {
    if (!partial && (b[k] === undefined || b[k] === '')) errors.push(`Campo requerido: ${k}`);
  };

  need('titulo');
  need('autor');

  if (b.stock !== undefined && b.stock < 0) errors.push('stock ≥ 0');
  if (b.precio !== undefined && b.precio < 0) errors.push('precio ≥ 0');
  if (b.anio !== undefined && (b.anio < 1800 || b.anio > currentYear)) {
    errors.push(`anio entre 1800 y ${currentYear}`);
  }
  if (b.estado !== undefined && !isValidEstado(b.estado)) {
    errors.push('estado inválido (disponible|prestado|baja)');
  }

  return { b, errors };
}

/* =========================================================
 * LISTADO (GET /api/libros)
 * ?search=&page=&limit=&sortBy=&sortDir=
 * ======================================================= */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();

    const sortByWhitelist = ['created_at', 'titulo', 'autor', 'anio', 'precio', 'stock'];
    const sortBy = sortByWhitelist.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const like = `%${search}%`;
    const where = search
      ? `WHERE (titulo ILIKE ? OR autor ILIKE ? OR categoria ILIKE ?)`
      : '';
    const params = search ? [like, like, like] : [];

    // total
    const countSql = `SELECT COUNT(*)::int AS total FROM books ${where};`;
    const countRes = await db.query(countSql, params);
    const total = rowsOf(countRes)[0]?.total || 0;

    // listado
    const listSql = `
      SELECT *
      FROM books
      ${where}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?;
    `;
    const listRes = await db.query(listSql, [...params, limit, offset]);
    const data = rowsOf(listRes);

    res.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * GET por id (GET /api/libros/:id)
 * ======================================================= */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const sql = `SELECT * FROM books WHERE id = ?;`;
    const rs = await db.query(sql, [Number(req.params.id)]);
    const row = rowsOf(rs)[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * CREAR (POST /api/libros)
 * ======================================================= */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    // Insert explícito con columnas fijas: evita comas colgantes
    const sql = `
      INSERT INTO books
        (titulo, autor, editorial, anio, categoria, ubicacion, stock, precio, estado, notas, created_at, updated_at)
      VALUES
        (?,      ?,     ?,        ?,    ?,        ?,        ?,     ?,      ?,      ?,    now(),     now())
      RETURNING *;
    `;
    const params = [
      (b.titulo || '').trim(),
      (b.autor || '').trim(),
      (b.editorial || '').trim(),
      b.anio ?? null,
      (b.categoria || '').trim(),
      (b.ubicacion || '').trim(),
      b.stock ?? 0,
      b.precio ?? 0,
      (b.estado || 'disponible').trim(),
      (b.notas || '').trim(),
    ];

    // Logs útiles si algo falla
    // console.log('INSERT SQL =>', sql);
    // console.log('PARAMS =>', params);

    const ins = await db.query(sql, params);
    const row = rowsOf(ins)[0];
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * UPDATE total (PUT /api/libros/:id)
 * ======================================================= */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const id = Number(req.params.id);

    const sql = `
      UPDATE books SET
        titulo    = ?, autor = ?, editorial = ?, anio = ?,
        categoria = ?, ubicacion = ?, stock = ?, precio = ?,
        estado    = ?, notas = ?, updated_at = now()
      WHERE id = ?
      RETURNING *;
    `;
    const params = [
      (b.titulo || '').trim(),
      (b.autor || '').trim(),
      (b.editorial || '').trim(),
      b.anio ?? null,
      (b.categoria || '').trim(),
      (b.ubicacion || '').trim(),
      b.stock ?? 0,
      b.precio ?? 0,
      (b.estado || 'disponible').trim(),
      (b.notas || '').trim(),
      id,
    ];

    const upd = await db.query(sql, params);
    const row = rowsOf(upd)[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * UPDATE parcial (PATCH /api/libros/:id)
 * ======================================================= */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    if (!Object.keys(b).length) return res.status(400).json({ error: 'Sin cambios' });

    const id = Number(req.params.id);

    const fields = Object.keys(b);
    const values = fields.map((k) => {
      if (['anio', 'stock', 'precio'].includes(k)) {
        const n = b[k];
        return n === '' || n === null || n === undefined ? null : Number(n);
      }
      return (b[k] ?? '').toString().trim();
    });

    // set dinámico + updated_at
    const setSql = fields.map((k) => `${k} = ?`).join(', ');
    const sql = `
      UPDATE books SET ${setSql}, updated_at = now()
      WHERE id = ?
      RETURNING *;
    `;
    const params = [...values, id];

    const upd = await db.query(sql, params);
    const row = rowsOf(upd)[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * DELETE lógico (DELETE /api/libros/:id) -> estado='baja'
 * ======================================================= */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sql = `
      UPDATE books
      SET estado = 'baja', updated_at = now()
      WHERE id = ?
      RETURNING id;
    `;
    const r = await db.query(sql, [id]);
    const row = rowsOf(r)[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
