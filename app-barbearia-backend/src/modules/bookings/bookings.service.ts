import { pool, query } from "../../database/pool";
import type { UserRole } from "../../types/user";
import { HttpError } from "../../utils/http-error";
import { getAvailability } from "../schedules/schedules.service";
import { addMinutes, canCancelWithinPolicy } from "../schedules/scheduling-rules";

type RequestUser = {
  id: string;
  role: UserRole;
};

type CreateBookingInput = {
  barberId: string;
  serviceId: string;
  date: string;
  startsAt: string;
};

export async function createBooking(userId: string, input: CreateBookingInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const databaseQuery = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => client.query<T>(sql, params);

    await databaseQuery("SELECT pg_advisory_xact_lock(hashtext($1))", [`booking:${input.barberId}:${input.date}`]);

    const clientResult = await databaseQuery<{ id: string }>("SELECT id FROM clients WHERE user_id = $1", [userId]);
    const bookingClient = clientResult.rows[0];
    if (!bookingClient) throw new HttpError(404, "CLIENT_NOT_FOUND", "Cliente nao encontrado");

    const serviceResult = await databaseQuery<{ price: number; duration_minutes: number }>(
      "SELECT price::float, duration_minutes FROM services WHERE id = $1 AND is_active = true",
      [input.serviceId]
    );
    const service = serviceResult.rows[0];
    if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "Servico nao encontrado");

    const availability = await getAvailability(input, databaseQuery);
    if (!availability.availableSlots.includes(input.startsAt)) {
      throw new HttpError(409, "BOOKING_SLOT_UNAVAILABLE", "Horario indisponivel");
    }

    const endsAt = addMinutes(input.startsAt, service.duration_minutes);

    const result = await databaseQuery(
      `INSERT INTO bookings (client_id, barber_id, service_id, date, starts_at, ends_at, status, price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
       RETURNING id, barber_id AS "barberId", service_id AS "serviceId",
                 date, starts_at AS "startsAt", ends_at AS "endsAt",
                 status, price_snapshot::float AS "priceSnapshot"`,
      [bookingClient.id, input.barberId, input.serviceId, input.date, input.startsAt, endsAt, service.price]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelBooking(user: RequestUser, bookingId: string, reason?: string) {
  const booking = await findBookingForAction(bookingId);
  if (!["scheduled", "confirmed"].includes(booking.status)) {
    throw new HttpError(409, "BOOKING_NOT_CANCELABLE", "Reserva nao pode ser cancelada neste status");
  }

  if (user.role === "client") {
    const client = await query<{ id: string }>("SELECT id FROM clients WHERE user_id = $1", [user.id]);
    if (booking.client_id !== client.rows[0]?.id) {
      throw new HttpError(403, "PERMISSION_DENIED", "Voce nao pode cancelar esta reserva");
    }

    const settings = await query<{ cancellation_limit_minutes: number }>(
      "SELECT cancellation_limit_minutes FROM settings ORDER BY created_at LIMIT 1"
    );
    const cancellationLimitMinutes = settings.rows[0]?.cancellation_limit_minutes ?? 120;
    if (!canCancelWithinPolicy({
      bookingDate: booking.date,
      startsAt: booking.starts_at,
      now: new Date(),
      cancellationLimitMinutes
    })) {
      throw new HttpError(409, "BOOKING_CANCELLATION_DEADLINE_PASSED", "Prazo de cancelamento expirado");
    }
  } else if (user.role !== "admin") {
    throw new HttpError(403, "PERMISSION_DENIED", "Voce nao pode cancelar esta reserva");
  }

  const result = await query(
    `UPDATE bookings
     SET status = 'canceled', cancel_reason = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, status`,
    [reason ?? null, bookingId]
  );

  return result.rows[0];
}

export async function completeBooking(user: RequestUser, bookingId: string) {
  await assertAdminOrResponsibleBarber(user, bookingId);
  return updateBookingStatus(bookingId, "completed");
}

export async function noShowBooking(user: RequestUser, bookingId: string) {
  await assertAdminOrResponsibleBarber(user, bookingId);
  return updateBookingStatus(bookingId, "no_show");
}

async function updateBookingStatus(bookingId: string, status: "completed" | "no_show") {
  const result = await query(
    `UPDATE bookings SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, status`,
    [status, bookingId]
  );
  return result.rows[0];
}

async function findBookingForAction(bookingId: string) {
  const result = await query<{ id: string; client_id: string; barber_id: string; date: string; starts_at: string; status: string }>(
    "SELECT id, client_id, barber_id, date::text, starts_at::text, status FROM bookings WHERE id = $1",
    [bookingId]
  );
  const booking = result.rows[0];
  if (!booking) throw new HttpError(404, "BOOKING_NOT_FOUND", "Reserva nao encontrada");
  return booking;
}

async function assertAdminOrResponsibleBarber(user: RequestUser, bookingId: string) {
  if (user.role === "admin") return;

  if (user.role !== "barber") {
    throw new HttpError(403, "PERMISSION_DENIED", "Voce nao tem permissao para esta acao");
  }

  const result = await query(
    `SELECT b.id
     FROM bookings b
     JOIN barbers br ON br.id = b.barber_id
     WHERE b.id = $1 AND br.user_id = $2`,
    [bookingId, user.id]
  );

  if (!result.rowCount) {
    throw new HttpError(403, "PERMISSION_DENIED", "Voce nao tem permissao para esta reserva");
  }
}
