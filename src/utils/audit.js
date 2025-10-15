// src/utils/audit.js
import db from '../db.js';

export async function logChange({
  entity,         // e.g. 'book'
  entityId,       // e.g. 123
  action,         // 'create' | 'update' | 'delete'
  before = null,
  after = null,
  req = null,     // para ip y user-agent
  user = null     // { id, username }
}) {
  const ip = req?.headers['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null;
  const ua = req?.headers['user-agent'] || null;
  const uid = user?.id ?? req?.session?.user?.id ?? null;

  await db.query(
    `INSERT INTO audit_logs (entity, entity_id, action, "before", "after", changed_by, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, now())`,
    [
      entity,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after  ? JSON.stringify(after)  : null,
      uid,
      ip,
      ua
    ]
  );
}
