import db from '../db.js';

export async function logAction({
  entity_type,       // 'book', 'user', etc.
  entity_id = null,
  action,            // 'create' | 'update' | 'delete' | ...
  before = null,
  after = null,
  changed_by = null,
  ip = null
}) {
  try {
    await db.query(
      `
      INSERT INTO audit_logs
        (entity_type, entity_id, action, before_data, after_data, changed_by, ip)
      VALUES
        ($1,          $2,        $3,     $4,          $5,        $6,        $7)
      `,
      [entity_type || 'unknown', entity_id, action, before, after, changed_by, ip]
    );
  } catch (e) {
    console.error('audit log error:', e.message);
  }
}