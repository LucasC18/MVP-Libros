// src/routes/logs.routes.js
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** GET /api/logs?entity=book&entityId=123&page=1&limit=20 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const entity   = (req.query.entity || '').trim();
    const entityId = req.query.entityId ? Number(req.query.entityId) : null;
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (entity)   { where.push('entity = ?');    params.push(entity); }
    if (entityId) { where.push('entity_id = ?'); params.push(entityId); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`, params);
    const total = countRes.recordset?.[0]?.total ?? 0;

    const rowsRes = await db.query(
      `SELECT id, entity, entity_id, action, "before", "after", changed_by, ip, user_agent, created_at
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rowsRes.recordset || [],
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) { next(err); }
});

/** GET /api/libros/:id/logs */
router.get('/libros/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const countRes = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE entity = 'book' AND entity_id = ?`,
      [id]
    );
    const total = countRes.recordset?.[0]?.total ?? 0;

    const rowsRes = await db.query(
      `SELECT id, action, "before", "after", changed_by, ip, user_agent, created_at
       FROM audit_logs
       WHERE entity = 'book' AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
       [id, limit, offset]
    );

    res.json({
      data: rowsRes.recordset || [],
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) { next(err); }
});

export default router;
