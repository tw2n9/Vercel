import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};

if (!env.databaseUrl) {
  console.warn("DATABASE_URL nao configurada. Configure o .env antes de rodar o backend.");
}

if (env.nodeEnv === "production" && (!env.jwtSecret || env.jwtSecret === "dev-secret" || env.jwtSecret === "troque_esta_chave")) {
  throw new Error("JWT_SECRET seguro e obrigatorio em producao.");
}
