import type { Booking } from "../api/reservationApi";
import { LONDON_TIME_ZONE } from "./londonDate";

const SLOT_MS = 30 * 60_000;
export const WEEK_DAYS = 7;

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const offsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  timeZoneName: "longOffset"
});
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

export function getLondonDay(instant: Date): string {
  const { year, month, day } = Object.fromEntries(
    dayFormatter.formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function getWeekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addCalendarDays(day, -((weekday + 6) % WEEK_DAYS));
}

// Keep in sync with getLastBookableDay in backend/src/services/date.service.ts.
export function getLastBookableDay(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  const month = date.getUTCMonth() + 1;
  date.setUTCMonth(month);
  // 31 Jan + 1 month overflows into March: clamp to the end of February.
  if (date.getUTCMonth() !== month % 12) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

export function londonMidnight(day: string): string {
  // London changes clocks after midnight, so UTC midnight has the same offset.
  const offset = offsetFormatter
    .formatToParts(new Date(`${day}T00:00:00Z`))
    .find(({ type }) => type === "timeZoneName")?.value;
  const suffix = offset && offset !== "GMT" ? offset.slice(3) : "Z";
  return new Date(`${day}T00:00:00${suffix}`).toISOString();
}

export function getStartTimes(day: string, now: number): string[] {
  const start = Date.parse(londonMidnight(day));
  const end = Date.parse(londonMidnight(addCalendarDays(day, 1)));
  const times = [];
  for (let time = start; time < end; time += SLOT_MS) {
    if (time > now) times.push(new Date(time).toISOString());
  }
  return times;
}

// The same London clock time on another day, or "" when that day skips it.
export function moveTimeToDay(time: string, day: string): string {
  if (!time) return "";
  const clock = clockFormatter.format(new Date(time));
  return (
    getStartTimes(day, -Infinity).find(
      (candidate) => clockFormatter.format(new Date(candidate)) === clock
    ) ?? ""
  );
}

export function getDayOccupancy(day: string, bookings: Booking[]) {
  const start = Date.parse(londonMidnight(day));
  const end = Date.parse(londonMidnight(addCalendarDays(day, 1)));
  const intervals = bookings.flatMap((booking) => {
    const overlap =
      Math.min(end, Date.parse(booking.endAt)) -
      Math.max(start, Date.parse(booking.startAt));
    return overlap > 0 ? [{ booking, overlap }] : [];
  });

  return {
    bookings: intervals.map(({ booking }) => booking),
    percentage: Math.round(
      (100 * intervals.reduce((total, { overlap }) => total + overlap, 0)) /
        (end - start)
    )
  };
}
