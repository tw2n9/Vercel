import { Router } from "express";
import { query } from "../../database/pool";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get("/", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, title, message, channel, status, created_at AS "createdAt", read_at AS "readAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user!.id]
  );
  res.json({ data: result.rows });
}));

notificationRoutes.patch("/:id/read", asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE notifications
     SET status = 'read', read_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, message, channel, status, created_at AS "createdAt", read_at AS "readAt"`,
    [req.params.id, req.user!.id]
  );
  res.json({ data: result.rows[0] ?? null, message: "Notificacao marcada como lida" });
}));
