// src/utils/audit.js
import db from '../db.js';

/**
 * Registra una acción en la tabla audit_logs.
 * Guarda el tipo de entidad, el id afectado, la acción y los datos antes/después.
 */
export async function logAction({
  entity_type,       // Ej: 'book', 'user'
  entity_id = null,  // ID del registro afectado
  action,            // Ej: 'create', 'update', 'delete'
  before = null,     // Datos anteriores (JSON)
  after = null,      // Datos nuevos (JSON)
  changed_by = null, // ID del admin o usuario
  ip = null          // IP opcional
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
