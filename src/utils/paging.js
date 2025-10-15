// src/utils/paging.js
import db from '../db.js';

export function buildPaging(limit, offset) {
  if (db.engine === 'pg') {
    // LIMIT ? OFFSET ?
    return { clause: 'LIMIT ? OFFSET ?', order: (l, o) => [l, o] };
  }
  // mssql
  return { clause: 'OFFSET ? ROWS FETCH NEXT ? ROWS ONLY', order: (l, o) => [o, l] };
}
