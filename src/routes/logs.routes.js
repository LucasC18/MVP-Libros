// src/routes/logs.routes.js
import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Historial de un libro
router.get('/libros/:id', requireAuth, async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const offset = (page - 1) * limit;

    const id = Number(req.params.id);

    const totalRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs
       WHERE entity_type='book' AND entity_id=$1`, [id]
    );
    const total = totalRes.rows[0]?.total || 0;

    const listRes = await db.query(
      `SELECT id, action, before, after, changed_by, ip, created_at
       FROM audit_logs
       WHERE entity_type='book' AND entity_id=$1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
       [id, limit, offset]
    );

    res.json({
      data: listRes.rows,
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total/limit))
    });
  } catch (err) { next(err); }
});

export default router;
