import { pool, query } from "./pool";

const services = [
  ["Corte", "Corte masculino", 50.0, 30],
  ["Barba", "Modelagem de barba", 40.0, 30],
  ["Sobrancelha", "Design de sobrancelha", 25.0, 20],
  ["Pigmentacao", "Pigmentacao capilar ou barba", 70.0, 45],
  ["Hidratacao", "Hidratacao capilar", 45.0, 30],
  ["Combo Corte + Barba", "Corte masculino com barba", 85.0, 60]
] as const;

async function seedServices() {
  for (const [name, description, price, durationMinutes] of services) {
    await query(
      `INSERT INTO services (name, description, price, duration_minutes, is_active)
       SELECT $1::varchar, $2::text, $3::numeric, $4::integer, true
       WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = $1::varchar)`,
      [name, description, price, durationMinutes]
    );
  }

  console.log("Servicos iniciais criados/verificados.");
}

seedServices()
  .catch((error) => {
    console.error("Erro ao criar servicos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
