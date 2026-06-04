import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { login, register } from "./auth.service";
import { requireAuth } from "../../middleware/auth";
import { query } from "../../database/pool";
import type { AuthUser } from "../../types/user";
import { loginRateLimit } from "../../middleware/login-rate-limit";

export const authRoutes = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRoutes.post("/register", asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const data = await register(payload);
  res.status(201).json({ data, message: "Conta criada com sucesso" });
}));

authRoutes.post("/login", loginRateLimit, asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const data = await login(payload);
  res.json({ data, message: "Login realizado com sucesso" });
}));

authRoutes.post("/forgot-password", asyncHandler(async (_req, res) => {
  res.json({ data: null, message: "Se o e-mail existir, enviaremos instrucoes" });
}));

authRoutes.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const result = await query<AuthUser>(
    "SELECT id, name, email, phone, role, is_active FROM users WHERE id = $1",
    [req.user!.id]
  );
  res.json({ data: result.rows[0] ?? null, message: "Usuario autenticado" });
}));
