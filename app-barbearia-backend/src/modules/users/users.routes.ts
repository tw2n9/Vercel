import { Router } from "express";
import { z } from "zod";
import { query } from "../../database/pool";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";

export const userRoutes = Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional()
});

userRoutes.use(requireAuth);

userRoutes.get("/me", asyncHandler(async (req, res) => {
  const result = await query(
    "SELECT id, name, email, phone, role FROM users WHERE id = $1",
    [req.user!.id]
  );

  res.json({ data: result.rows[0] });
}));

userRoutes.patch("/me", asyncHandler(async (req, res) => {
  const payload = updateProfileSchema.parse(req.body);

  const result = await query(
    `UPDATE users
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         updated_at = now()
     WHERE id = $3
     RETURNING id, name, email, phone, role`,
    [payload.name, payload.phone, req.user!.id]
  );

  res.json({ data: result.rows[0], message: "Perfil atualizado" });
}));
