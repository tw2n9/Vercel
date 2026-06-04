import { Router } from "express";
import { z } from "zod";
import { query } from "../../database/pool";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { cancelBooking, completeBooking, createBooking, noShowBooking } from "./bookings.service";

export const bookingRoutes = Router();

bookingRoutes.use(requireAuth);

const createBookingSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string(),
  startsAt: z.string()
});

bookingRoutes.post("/", requireRole("client"), asyncHandler(async (req, res) => {
  const payload = createBookingSchema.parse(req.body);
  const data = await createBooking(req.user!.id, payload);
  res.status(201).json({ data, message: "Reserva criada" });
}));

bookingRoutes.get("/my", requireRole("client"), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT b.id, s.name AS "serviceName", br.public_name AS "barberName",
            b.date, b.starts_at AS "startsAt", b.ends_at AS "endsAt",
            b.status, b.price_snapshot::float AS "priceSnapshot"
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     JOIN services s ON s.id = b.service_id
     JOIN barbers br ON br.id = b.barber_id
     WHERE c.user_id = $1
       AND ($2::text IS NULL OR b.status::text = $2)
     ORDER BY b.date DESC, b.starts_at DESC`,
    [req.user!.id, req.query.status ?? null]
  );
  res.json({ data: result.rows });
}));

bookingRoutes.get("/admin", requireRole("admin"), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT b.id, u.name AS "clientName", br.public_name AS "barberName",
            s.name AS "serviceName", b.date, b.starts_at AS "startsAt",
            b.ends_at AS "endsAt", b.status
     FROM bookings b
     JOIN clients c ON c.id = b.client_id
     JOIN users u ON u.id = c.user_id
     JOIN barbers br ON br.id = b.barber_id
     JOIN services s ON s.id = b.service_id
     WHERE ($1::date IS NULL OR b.date = $1)
       AND ($2::uuid IS NULL OR b.barber_id = $2)
       AND ($3::text IS NULL OR b.status::text = $3)
     ORDER BY b.date, b.starts_at`,
    [req.query.date ?? null, req.query.barberId ?? null, req.query.status ?? null]
  );
  res.json({ data: result.rows });
}));

bookingRoutes.get("/barber/me", requireRole("barber"), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT b.id, u.name AS "clientName", s.name AS "serviceName",
            b.date, b.starts_at AS "startsAt", b.ends_at AS "endsAt", b.status
     FROM bookings b
     JOIN barbers br ON br.id = b.barber_id
     JOIN clients c ON c.id = b.client_id
     JOIN users u ON u.id = c.user_id
     JOIN services s ON s.id = b.service_id
     WHERE br.user_id = $1
       AND ($2::date IS NULL OR b.date = $2)
     ORDER BY b.date, b.starts_at`,
    [req.user!.id, req.query.date ?? null]
  );
  res.json({ data: result.rows });
}));

bookingRoutes.patch("/:id/cancel", asyncHandler(async (req, res) => {
  const data = await cancelBooking(req.user!, String(req.params.id), req.body?.reason);
  res.json({ data, message: "Reserva cancelada" });
}));

bookingRoutes.patch("/:id/complete", asyncHandler(async (req, res) => {
  const data = await completeBooking(req.user!, String(req.params.id));
  res.json({ data, message: "Atendimento concluido" });
}));

bookingRoutes.patch("/:id/no-show", asyncHandler(async (req, res) => {
  const data = await noShowBooking(req.user!, String(req.params.id));
  res.json({ data, message: "Nao comparecimento registrado" });
}));

bookingRoutes.get("/:id", asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM bookings WHERE id = $1", [req.params.id]);
  res.json({ data: result.rows[0] ?? null });
}));
