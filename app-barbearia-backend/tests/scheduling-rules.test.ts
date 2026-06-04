import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMinutes,
  buildAvailableSlots,
  canCancelWithinPolicy,
  hasBlockConflict,
  hasScheduleConflict,
  intervalsOverlap
} from "../src/modules/schedules/scheduling-rules";

describe("scheduling rules", () => {
  it("generates slots inside the intersection between business and barber hours", () => {
    const slots = buildAvailableSlots({
      businessHours: { startsAt: "09:00", endsAt: "18:00" },
      barberHours: { startsAt: "10:00", endsAt: "12:00" },
      busyIntervals: [],
      durationMinutes: 30,
      slotIntervalMinutes: 30
    });

    assert.deepEqual(slots, ["10:00", "10:30", "11:00", "11:30"]);
  });

  it("does not return slots that overlap existing bookings or blocks", () => {
    const slots = buildAvailableSlots({
      businessHours: { startsAt: "09:00", endsAt: "12:00" },
      barberHours: { startsAt: "09:00", endsAt: "12:00" },
      busyIntervals: [
        { startsAt: "09:30", endsAt: "10:30" },
        { startsAt: "11:00", endsAt: "11:30" }
      ],
      durationMinutes: 30,
      slotIntervalMinutes: 30
    });

    assert.deepEqual(slots, ["09:00", "10:30", "11:30"]);
  });

  it("allows adjacent intervals and blocks real overlaps", () => {
    assert.equal(intervalsOverlap("09:00", "09:30", "09:30", "10:00"), false);
    assert.equal(intervalsOverlap("09:00", "10:00", "09:30", "10:30"), true);
    assert.equal(hasScheduleConflict(
      { startsAt: "10:00", endsAt: "10:30" },
      [{ startsAt: "09:30", endsAt: "10:01" }]
    ), true);
  });

  it("calculates end time from service duration", () => {
    assert.equal(addMinutes("09:45", 50), "10:35");
  });

  it("detects specific and global schedule block conflicts", () => {
    const existingBlocks = [
      { barberId: "barber-1", startsAt: "09:00", endsAt: "10:00" },
      { barberId: null, startsAt: "13:00", endsAt: "14:00" }
    ];

    assert.equal(hasBlockConflict(
      { barberId: "barber-2", startsAt: "09:30", endsAt: "10:30" },
      existingBlocks
    ), false);
    assert.equal(hasBlockConflict(
      { barberId: "barber-1", startsAt: "09:30", endsAt: "10:30" },
      existingBlocks
    ), true);
    assert.equal(hasBlockConflict(
      { barberId: "barber-2", startsAt: "13:30", endsAt: "14:30" },
      existingBlocks
    ), true);
    assert.equal(hasBlockConflict(
      { barberId: null, startsAt: "09:30", endsAt: "10:30" },
      existingBlocks
    ), true);
  });

  it("enforces the cancellation deadline", () => {
    const now = new Date("2026-06-03T10:00:00");

    assert.equal(canCancelWithinPolicy({
      bookingDate: "2026-06-03",
      startsAt: "12:00",
      now,
      cancellationLimitMinutes: 120
    }), true);

    assert.equal(canCancelWithinPolicy({
      bookingDate: "2026-06-03",
      startsAt: "11:59",
      now,
      cancellationLimitMinutes: 120
    }), false);
  });
});
