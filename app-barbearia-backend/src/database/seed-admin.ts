import bcrypt from "bcryptjs";
import { pool, query } from "./pool";

async function seedAdmin() {
  const name = process.env.ADMIN_NAME ?? "Admin Barbearia";
  const email = process.env.ADMIN_EMAIL ?? "admin@barbearia.local";
  const phone = process.env.ADMIN_PHONE ?? "+5500000000000";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);

  if (existing.rowCount) {
    console.log(`Admin ja existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query<{ id: string; email: string }>(
    `INSERT INTO users (name, email, phone, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, 'admin', true)
     RETURNING id, email`,
    [name, email, phone, passwordHash]
  );

  console.log(`Admin criado: ${result.rows[0].email}`);
  console.log("Senha inicial definida por ADMIN_PASSWORD ou padrao admin123.");
}

seedAdmin()
  .catch((error) => {
    console.error("Erro ao criar admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
