// src/routes/books.routes.js
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildPaging } from '../utils/paging.js';

const router = Router();

const isValidEstado = (v) => ['disponible', 'prestado', 'baja'].includes(v);
const now = () => new Date();

function sanitizeBook(body, { partial = false } = {}) {
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
  const need = (k) => { if (!partial && (b[k] === undefined || b[k] === '')) errors.push(`Campo requerido: ${k}`); };

  need('titulo'); need('autor');
  if (b.stock !== undefined && b.stock < 0) errors.push('stock ≥ 0');
  if (b.precio !== undefined && b.precio < 0) errors.push('precio ≥ 0');
  if (b.anio !== undefined && (b.anio < 1800 || b.anio > currentYear)) errors.push(`anio entre 1800 y ${currentYear}`);
  if (b.estado !== undefined && !isValidEstado(b.estado)) errors.push('estado inválido (disponible|prestado|baja)');

  return { b, errors };
}

/* LISTADO */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const sortBy = ['created_at', 'titulo', 'autor', 'anio', 'precio', 'stock'].includes(req.query.sortBy)
      ? req.query.sortBy : 'created_at';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const like = `%${search}%`;
    const where = search ? 'WHERE (titulo LIKE ? OR autor LIKE ? OR categoria LIKE ?)' : '';
    const params = search ? [like, like, like] : [];

    const totalRes = await db.query(`SELECT COUNT(*) AS total FROM books ${where}`, params);
    const total = (totalRes.recordset?.[0]?.total) ?? (totalRes.recordset?.[0]?.count) ?? 0;

    const { clause, order } = buildPaging(limit, offset);
    const pagingParams = order(limit, offset);

    const listRes = await db.query(
      `
      SELECT *
      FROM books
      ${where}
      ORDER BY ${sortBy} ${sortDir}
      ${clause}
      `,
      [...params, ...pagingParams]
    );

    res.json({
      data: listRes.recordset || [],
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) { next(err); }
});

/* GET id */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const rs = await db.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    const row = (rs.recordset || [])[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(row);
  } catch (err) { next(err); }
});

/* CREATE */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    b.created_at = now();
    b.updated_at = now();

    const cols = Object.keys(b);
    const vals = Object.values(b);
    const placeholders = cols.map(() => '?').join(', ');

    const insertSql = `
      INSERT INTO books (${cols.join(', ')})
      VALUES (${placeholders})
      ${db.engine === 'pg' ? 'RETURNING *' : ''}
    `;

    const ins = await db.query(insertSql, vals);

    if (db.engine === 'pg') {
      return res.status(201).json(ins.recordset[0]);
    }
    // mssql: volver a leer
    const idRes = await db.query('SELECT TOP 1 id FROM books ORDER BY id DESC');
    const id = idRes.recordset?.[0]?.id;
    const rs = await db.query('SELECT * FROM books WHERE id = ?', [id]);
    res.status(201).json(rs.recordset[0]);
  } catch (err) { next(err); }
});

/* PATCH (update parcial) */
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { b, errors } = sanitizeBook(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    if (!Object.keys(b).length) return res.status(400).json({ error: 'Sin cambios' });

    b.updated_at = now();

    const fields = Object.keys(b);
    const setSql = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => b[k]);

    const upd = await db.query(`UPDATE books SET ${setSql} WHERE id = ?`, [...values, req.params.id]);
    if ((upd.rowsAffected?.[0] || 0) === 0) return res.status(404).json({ error: 'No encontrado' });

    const rs = await db.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json(rs.recordset[0]);
  } catch (err) { next(err); }
});

/* DELETE lógico -> estado=baja */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const upd = await db.query('UPDATE books SET estado = ?, updated_at = ? WHERE id = ?', ['baja', now(), req.params.id]);
    if ((upd.rowsAffected?.[0] || 0) === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
