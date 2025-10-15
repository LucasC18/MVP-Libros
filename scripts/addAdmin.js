// scripts/addAdmin.js
// Uso: node scripts/addAdmin.js <username> <password>
import 'dotenv/config';
import bcrypt from 'bcrypt';
import sql from 'mssql';

async function main() {
  const [ , , username, plainPass ] = process.argv;
  if (!username || !plainPass) {
    console.error('Uso: node scripts/addAdmin.js <username> <password>');
    process.exit(1);
  }

  // Lee .env (formato que usaste antes)
  const config = {
    server: process.env.MSSQL_SERVER || '127.0.0.1',
    port: Number(process.env.MSSQL_PORT || 1433),
    database: process.env.MSSQL_DB || 'colegio',
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASS || '',
    options: {
      encrypt: false,           // local
      trustServerCertificate: true
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
  };

  const hash = await bcrypt.hash(plainPass, 10);

  let pool;
  try {
    pool = await sql.connect(config);

    // Verificar duplicado
    const dup = await pool.request()
      .input('u', sql.VarChar(100), username)
      .query('SELECT id FROM admin_users WHERE username = @u');

    if (dup.recordset.length) {
      console.error('❌ Ya existe un admin con ese username.');
      process.exit(1);
    }

    // Insertar
    const result = await pool.request()
      .input('u', sql.VarChar(100), username)
      .input('p', sql.VarChar(255), hash)
      .query(`
        INSERT INTO admin_users (username, password_hash, created_at)
        VALUES (@u, @p, SYSDATETIME());
        SELECT SCOPE_IDENTITY() AS id;
      `);

    console.log('✅ Admin creado:', { id: result.recordset[0].id, username });
  } catch (err) {
    console.error('❌ Error creando admin:', err.message);
    process.exit(1);
  } finally {
    if (pool) pool.close();
  }
}

main();
