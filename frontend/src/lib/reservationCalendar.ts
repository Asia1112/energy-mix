import { LONDON_TIME_ZONE } from "./londonDate";

const SLOT_MS = 30 * 60_000;
export const WEEK_DAYS = 7;
export type CalendarView = "week" | "month";

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

export function getLondonDay(instant: Date): string {
  const { year, month, day } = Object.fromEntries(
    dayFormatter.formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return `${year}-${month}-${day}`;
}

export function parseReservationDate(value: string): string | null {
  const text = value.trim().replace(/^(\d{2})(\d{2})(\d{4})$/, "$1/$2/$3");
  const parts = /^(\d{1,2})([./-])(\d{1,2})\2([1-9]\d{3})$/.exec(text);
  if (!parts) return null;

  const [, day, , month, year] = parts;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const instant = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === date
    ? date
    : null;
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

export function getMonthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function addCalendarMonths(monthStart: string, count: number): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
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
