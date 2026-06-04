export type TimeInterval = {
  startsAt: string;
  endsAt: string;
};

export type ScheduleBlock = TimeInterval & {
  barberId?: string | null;
};

export type AvailabilityRuleInput = {
  businessHours?: TimeInterval | null;
  barberHours?: TimeInterval | null;
  busyIntervals: TimeInterval[];
  durationMinutes: number;
  slotIntervalMinutes: number;
};

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function addMinutes(time: string, minutesToAdd: number) {
  return toTime(toMinutes(time) + minutesToAdd);
}

export function intervalsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

export function hasScheduleConflict(candidate: TimeInterval, busyIntervals: TimeInterval[]) {
  return busyIntervals.some((busy) => (
    intervalsOverlap(candidate.startsAt, candidate.endsAt, busy.startsAt, busy.endsAt)
  ));
}

export function hasBlockConflict(candidate: ScheduleBlock, blocks: ScheduleBlock[]) {
  return blocks.some((block) => {
    const affectsSameBarber = !candidate.barberId || !block.barberId || candidate.barberId === block.barberId;
    return affectsSameBarber && intervalsOverlap(candidate.startsAt, candidate.endsAt, block.startsAt, block.endsAt);
  });
}

export function buildAvailableSlots(input: AvailabilityRuleInput) {
  if (!input.businessHours || !input.barberHours) return [];

  const start = Math.max(toMinutes(input.businessHours.startsAt), toMinutes(input.barberHours.startsAt));
  const end = Math.min(toMinutes(input.businessHours.endsAt), toMinutes(input.barberHours.endsAt));
  const availableSlots: string[] = [];

  if (input.durationMinutes <= 0 || input.slotIntervalMinutes <= 0 || start >= end) {
    return availableSlots;
  }

  for (let cursor = start; cursor + input.durationMinutes <= end; cursor += input.slotIntervalMinutes) {
    const candidate = {
      startsAt: toTime(cursor),
      endsAt: toTime(cursor + input.durationMinutes)
    };

    if (!hasScheduleConflict(candidate, input.busyIntervals)) {
      availableSlots.push(candidate.startsAt);
    }
  }

  return availableSlots;
}

export function canCancelWithinPolicy(input: {
  bookingDate: string;
  startsAt: string;
  now: Date;
  cancellationLimitMinutes: number;
}) {
  const startsAt = new Date(`${input.bookingDate}T${input.startsAt}`);
  const minutesUntilBooking = (startsAt.getTime() - input.now.getTime()) / 60000;
  return minutesUntilBooking >= input.cancellationLimitMinutes;
}
