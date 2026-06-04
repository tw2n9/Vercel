import { Router } from "express";
import { query } from "../../database/pool";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";

export const clientRoutes = Router();

clientRoutes.use(requireAuth, requireRole("admin"));

clientRoutes.get("/", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.id, u.name, u.email, u.phone,
            COUNT(b.id)::int AS "bookingsCount",
            MAX(b.date) AS "lastBookingAt"
     FROM clients c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN bookings b ON b.client_id = c.id
     WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.phone ILIKE '%' || $1 || '%')
     GROUP BY c.id, u.name, u.email, u.phone
     ORDER BY u.name`,
    [req.query.search ?? null]
  );
  res.json({ data: result.rows });
}));

clientRoutes.get("/:id", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT c.id, u.name, u.email, u.phone, u.created_at AS "createdAt"
     FROM clients c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  res.json({ data: result.rows[0] ?? null });
}));

clientRoutes.get("/:id/bookings", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT b.id, s.name AS "serviceName", br.public_name AS "barberName",
            b.date, b.starts_at AS "startsAt", b.status
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN barbers br ON br.id = b.barber_id
     WHERE b.client_id = $1
     ORDER BY b.date DESC, b.starts_at DESC`,
    [req.params.id]
  );
  res.json({ data: result.rows });
}));
