// src/seed/seedAdmin.js
import bcrypt from "bcrypt";
import db from "../db.js";

async function seedAdmin() {
  try {
    const username = "admin";
    const password = "Admin123!";
    const hash = await bcrypt.hash(password, 10);

    // Verificar si ya existe
    const [exists] = await db.query(
      "SELECT id FROM admin_users WHERE username = ?",
      [username]
    );

    if (exists.length) {
      console.log("⚠️  El usuario admin ya existe.");
      return;
    }

    await db.query(
      "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
      [username, hash]
    );

    console.log("✅ Usuario admin creado correctamente:");
    console.log(`   Usuario: ${username}`);
    console.log(`   Contraseña: ${password}`);
  } catch (err) {
    console.error("❌ Error al crear el usuario admin:", err);
  } finally {
    process.exit();
  }
}

seedAdmin();
