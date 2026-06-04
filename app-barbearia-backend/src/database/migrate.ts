import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

async function migrate() {
  const migrationPath = path.resolve(__dirname, "migrations", "001_initial_schema.sql");
  const sql = await fs.readFile(migrationPath, "utf8");
  await pool.query(sql);
  await pool.end();
  console.log("Migration executada com sucesso.");
}

migrate().catch(async (error) => {
  console.error("Erro ao executar migration:", error);
  await pool.end();
  process.exit(1);
});
