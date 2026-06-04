import { query } from "../../database/pool";
import { HttpError } from "../../utils/http-error";
import { buildAvailableSlots, hasBlockConflict, type ScheduleBlock, type TimeInterval } from "./scheduling-rules";

type AvailabilityInput = {
  barberId: string;
  serviceId: string;
  date: string;
};

type CreateScheduleBlockInput = {
  barberId?: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
};

type QueryExecutor = typeof query;

export async function getAvailability(input: AvailabilityInput, databaseQuery: QueryExecutor = query) {
  const serviceResult = await databaseQuery<{ duration_minutes: number; is_active: boolean }>(
    "SELECT duration_minutes, is_active FROM services WHERE id = $1",
    [input.serviceId]
  );
  const service = serviceResult.rows[0];
  if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "Servico nao encontrado");
  if (!service.is_active) throw new HttpError(422, "SERVICE_INACTIVE", "Servico inativo");

  const barberResult = await databaseQuery<{ is_active: boolean }>(
    "SELECT is_active FROM barbers WHERE id = $1",
    [input.barberId]
  );
  const barber = barberResult.rows[0];
  if (!barber) throw new HttpError(404, "BARBER_NOT_FOUND", "Barbeiro nao encontrado");
  if (!barber.is_active) throw new HttpError(422, "BARBER_INACTIVE", "Barbeiro inativo");

  const weekday = new Date(`${input.date}T00:00:00`).getDay();

  const businessResult = await databaseQuery<{ opens_at: string; closes_at: string }>(
    "SELECT opens_at, closes_at FROM business_hours WHERE weekday = $1 AND is_active = true",
    [weekday]
  );
  const businessHours = businessResult.rows[0];
  if (!businessHours) return { ...input, availableSlots: [] };

  const barberHoursResult = await databaseQuery<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM barber_working_hours
     WHERE barber_id = $1 AND weekday = $2 AND is_active = true`,
    [input.barberId, weekday]
  );
  const barberHours = barberHoursResult.rows[0];
  if (!barberHours) return { ...input, availableSlots: [] };

  const bookings = await databaseQuery<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM bookings
     WHERE barber_id = $1
       AND date = $2
       AND status IN ('scheduled', 'confirmed')`,
    [input.barberId, input.date]
  );

  const blocks = await databaseQuery<{ starts_at: string; ends_at: string }>(
    `SELECT starts_at, ends_at FROM schedule_blocks
     WHERE date = $1 AND (barber_id = $2 OR barber_id IS NULL)`,
    [input.date, input.barberId]
  );

  const busyIntervals: TimeInterval[] = [
    ...bookings.rows.map((item) => ({ startsAt: item.starts_at, endsAt: item.ends_at })),
    ...blocks.rows.map((item) => ({ startsAt: item.starts_at, endsAt: item.ends_at }))
  ];

  const settings = await databaseQuery<{ default_slot_interval_minutes: number }>(
    "SELECT default_slot_interval_minutes FROM settings ORDER BY created_at LIMIT 1"
  );

  return {
    date: input.date,
    barberId: input.barberId,
    serviceId: input.serviceId,
    availableSlots: buildAvailableSlots({
      businessHours: { startsAt: businessHours.opens_at, endsAt: businessHours.closes_at },
      barberHours: { startsAt: barberHours.starts_at, endsAt: barberHours.ends_at },
      busyIntervals,
      durationMinutes: service.duration_minutes,
      slotIntervalMinutes: settings.rows[0]?.default_slot_interval_minutes ?? 30
    })
  };
}

export async function createScheduleBlock(input: CreateScheduleBlockInput) {
  const candidate = {
    barberId: input.barberId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt
  };

  const conflictingBookings = await query<{ id: string }>(
    `SELECT id FROM bookings
     WHERE date = $1
       AND status IN ('scheduled', 'confirmed')
       AND ($2::uuid IS NULL OR barber_id = $2)
       AND starts_at < $4
       AND ends_at > $3
     LIMIT 1`,
    [input.date, input.barberId ?? null, input.startsAt, input.endsAt]
  );

  if (conflictingBookings.rowCount) {
    throw new HttpError(409, "SCHEDULE_BLOCK_BOOKING_CONFLICT", "Bloqueio conflita com reserva existente");
  }

  const existingBlocks = await query<{ barber_id: string | null; starts_at: string; ends_at: string }>(
    `SELECT barber_id, starts_at, ends_at FROM schedule_blocks
     WHERE date = $1
       AND ($2::uuid IS NULL OR barber_id = $2 OR barber_id IS NULL)`,
    [input.date, input.barberId ?? null]
  );

  const blocks: ScheduleBlock[] = existingBlocks.rows.map((block) => ({
    barberId: block.barber_id,
    startsAt: block.starts_at,
    endsAt: block.ends_at
  }));

  if (hasBlockConflict(candidate, blocks)) {
    throw new HttpError(409, "SCHEDULE_BLOCK_OVERLAP", "Bloqueio conflita com outro bloqueio");
  }

  const result = await query(
    `INSERT INTO schedule_blocks (barber_id, date, starts_at, ends_at, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, barber_id AS "barberId", date, starts_at AS "startsAt", ends_at AS "endsAt", reason`,
    [input.barberId ?? null, input.date, input.startsAt, input.endsAt, input.reason ?? null]
  );

  return result.rows[0];
}
