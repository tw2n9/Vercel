import { Router } from "express";
import { z } from "zod";
import { query } from "../../database/pool";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";

export const settingsRoutes = Router();

const settingsSchema = z.object({
  businessName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  cancellationLimitMinutes: z.number().int().min(0).optional(),
  defaultSlotIntervalMinutes: z.number().int().positive().optional(),
  cancellationPolicyText: z.string().optional().nullable()
});

settingsRoutes.get("/", asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT business_name AS "businessName",
            phone,
            address,
            cancellation_limit_minutes AS "cancellationLimitMinutes",
            default_slot_interval_minutes AS "defaultSlotIntervalMinutes",
            cancellation_policy_text AS "cancellationPolicyText"
     FROM settings
     ORDER BY created_at
     LIMIT 1`
  );
  res.json({ data: result.rows[0] ?? null });
}));

settingsRoutes.patch("/", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const payload = settingsSchema.parse(req.body);
  const result = await query(
    `UPDATE settings
     SET business_name = COALESCE($1, business_name),
         phone = COALESCE($2, phone),
         address = COALESCE($3, address),
         cancellation_limit_minutes = COALESCE($4, cancellation_limit_minutes),
         default_slot_interval_minutes = COALESCE($5, default_slot_interval_minutes),
         cancellation_policy_text = COALESCE($6, cancellation_policy_text),
         updated_at = now()
     WHERE id = (SELECT id FROM settings ORDER BY created_at LIMIT 1)
     RETURNING business_name AS "businessName",
               phone,
               address,
               cancellation_limit_minutes AS "cancellationLimitMinutes",
               default_slot_interval_minutes AS "defaultSlotIntervalMinutes",
               cancellation_policy_text AS "cancellationPolicyText"`,
    [
      payload.businessName,
      payload.phone,
      payload.address,
      payload.cancellationLimitMinutes,
      payload.defaultSlotIntervalMinutes,
      payload.cancellationPolicyText
    ]
  );
  res.json({ data: result.rows[0], message: "Configuracoes atualizadas" });
}));
