# Backend MVP - Aplicativo de Barbearia

Backend inicial em Node.js, Express, TypeScript e PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL

## Configuracao

1. Copie `.env.example` para `.env`.
2. Configure `DATABASE_URL`.
3. Instale as dependencias:

```bash
npm install
```

4. Suba um PostgreSQL local.

Com Docker:

```bash
docker compose up -d
```

Ou use um PostgreSQL/Supabase/Neon externo e atualize `DATABASE_URL`.

5. Rode a migration:

```bash
npm run db:migrate
```

6. Crie o admin inicial:

```bash
npm run db:seed-admin
```

Crie os servicos iniciais:

```bash
npm run db:seed-services
```

Credenciais padrao do `.env` de desenvolvimento:

```text
admin@barbearia.local
admin123
```

7. Inicie em desenvolvimento:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:3000/health
```

## Estrutura

```text
src/
  config/
  database/
  middleware/
  modules/
  types/
  utils/
```

## Modulos Criados

- Auth
- Users
- Services
- Barbers
- Schedules
- Bookings
- Clients
- Notifications
- Settings

## Proximas Implementacoes

- Criar seed de admin inicial.
- Adicionar testes.
- Melhorar validacao de prazo de cancelamento.
- Adicionar auditoria administrativa.
- Adicionar envio real de e-mail.
- Adicionar rate limit em login.
