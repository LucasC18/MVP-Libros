// src/routes/books.routes.js
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAction } from '../utils/audit.js';

const router = Router();
const isValidEstado = v => ['disponible','prestado','baja'].includes(v);
const now = () => new Date();

/* -------- helpers de sanitización -------- */
function sanitizeBook(body, { partial=false } = {}) {
  const b = {};
  const setIf = (k, v) => { if (v !== undefined && v !== null && v !== '') b[k] = v; };

  setIf('isbn', body.isbn?.toString().trim());
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
  const need = k => { if (!partial && (b[k] === undefined || b[k] === '')) errors.push(`Campo requerido: ${k}`); };

  need('titulo'); need('autor');
  if (b.stock !== undefined && b.stock < 0) errors.push('stock ≥ 0');
  if (b.precio !== undefined && b.precio < 0) errors.push('precio ≥ 0');
  if (b.anio !== undefined && (b.anio < 1800 || b.anio > currentYear)) errors.push(`anio entre 1800 y ${currentYear}`);
  if (b.estado !== undefined && !isValidEstado(b.estado)) errors.push('estado inválido (disponible|prestado|baja)');

  return { b, errors };
}

/* -------- LISTA (oculta bajas por defecto) -------- */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const includeBaja = req.query.includeBaja === 'true';

    const whereParts = [];
    const params = [];
    let p = 1;

    if (search) {
      whereParts.push(`(titulo ILIKE $${p} OR autor ILIKE $${p} OR categoria ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (!includeBaja) {
      whereParts.push(`estado != 'baja'`);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalSql = `SELECT COUNT(*)::int AS total FROM books ${where}`;
    const totalRes = await db.query(totalSql, params);
    const total = totalRes.rows[0]?.total || 0;

    const listSql = `
      SELECT *
      FROM books
      ${where}
      ORDER BY created_at DESC
      LIMIT $${p} OFFSET $${p+1}
    `;
    const listRes = await db.query(listSql, [...params, limit, offset]);

    res.json({
      data: listRes.rows || [],
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total/limit))
    });
  } catch (err) { next(err); }
});

/* -------- GET by id -------- */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM books WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

/* -------- CREATE -------- */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    b.created_at = now();
    b.updated_at = now();
    if (!b.estado) b.estado = 'disponible';

    const cols = Object.keys(b);
    const vals = Object.values(b);
    const marks = cols.map((_,i)=>`$${i+1}`).join(', ');

    const sql = `
      INSERT INTO books (${cols.join(', ')})
      VALUES (${marks})
      RETURNING *
    `;
    const ins = await db.query(sql, vals);
    const row = ins.rows[0];

    await logAction({
      entity_type: 'book',
      entity_id: row.id,
      action: 'create',
      before: null,
      after: row,
      changed_by: req.session?.user?.id || null,
      ip: req.ip
    });

    res.status(201).json(row);
  } catch (err) {
    const msg = err?.detail || err?.message || 'Error';
    console.error('❌ POST /api/libros', msg, err);
    res.status(500).json({ error: msg });
}

});

/* -------- PATCH (update parcial) -------- */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    if (!Object.keys(b).length) return res.status(400).json({ error: 'Sin cambios' });

    const beforeRes = await db.query('SELECT * FROM books WHERE id=$1', [req.params.id]);
    if (!beforeRes.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const before = beforeRes.rows[0];

    b.updated_at = now();

    const fields = Object.keys(b);
    const sets = fields.map((k,i)=>`${k}=$${i+1}`).join(', ');
    const vals = fields.map(k=>b[k]);

    const upd = await db.query(
      `UPDATE books SET ${sets} WHERE id=$${fields.length+1} RETURNING *`,
      [...vals, req.params.id]
    );
    const row = upd.rows[0];

    await logAction({
      entity_type: 'book',
      entity_id: row.id,
      action: 'update',
      before,
      after: row,
      changed_by: req.session?.user?.id || null,
      ip: req.ip
    });

    res.json(row);
} catch (err) {
   const msg = err?.detail || err?.message || 'Error';
   console.error('❌ PATCH /api/libros/:id', msg, err);
  res.status(500).json({ error: msg });
 }
});

/* -------- DELETE lógico (estado=baja) -------- */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const beforeRes = await db.query('SELECT * FROM books WHERE id=$1', [req.params.id]);
    if (!beforeRes.rows.length) return res.status(404).json({ error: 'No encontrado' });
    const before = beforeRes.rows[0];

    const upd = await db.query(
      `UPDATE books SET estado='baja', updated_at=$1 WHERE id=$2 RETURNING *`,
      [now(), req.params.id]
    );
    const row = upd.rows[0];

    await logAction({
      entity_type: 'book',
      entity_id: row.id,
      action: 'delete',
      before,
      after: row,
      changed_by: req.session?.user?.id || null,
      ip: req.ip
    });

    // devolvemos deleted:true para que el front quite la fila del DOM
    res.json({ deleted: true, id: row.id });
} catch (err) {
  const msg = err?.detail || err?.message || 'Error';
  console.error('❌ DELETE /api/libros/:id', msg, err);
 res.status(500).json({ error: msg });
}
});

export default router;
