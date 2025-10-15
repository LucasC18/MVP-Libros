import db from '../db.js';

export async function logAction({
  entity_type,     // 'book', 'user', etc.
  entity_id = null,
  action,          // 'create' | 'update' | 'delete' | etc
  before = null,
  after = null,
  changed_by = null,
  ip = null
}) {
  // Backfill: si sólo nos pasan entity_type, usamos lo mismo para 'entity'
  const entity = entity_type || 'unknown';

  try {
    await db.query(
      `
      INSERT INTO audit_logs
        (entity, entity_type, entity_id, action, before_data, after_data, changed_by, ip)
      VALUES
        ($1,     $2,          $3,       $4,     $5,          $6,        $7,        $8)
      `,
      [entity, entity_type, entity_id, action, before, after, changed_by, ip]
    );
  } catch (e) {
    console.error('audit log error:', e.message);
  }
}