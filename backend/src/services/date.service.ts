const LONDON_TIME_ZONE = "Europe/London";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
export const GENERATION_INTERVAL_MS = 30 * MINUTE_MS;
const CHARGING_FORECAST_HOURS = 48;
const MIX_DAY_COUNT = 3;

const londonDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const londonOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  timeZoneName: "longOffset"
});

export function getLondonDate(date: Date): string {
  const { year, month, day } = Object.fromEntries(
    londonDateFormatter
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  return `${year}-${month}-${day}`;
}

// UTC is used here only to advance the calendar date, independent of DST.
function addCalendarDays(date: string, days: number): string {
  const calendarDate = new Date(`${date}T00:00:00Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() + days);
  return calendarDate.toISOString().slice(0, 10);
}

function londonMidnight(date: string): string {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  // UK clock changes occur after local midnight, so the offset still matches.
  const offset = londonOffsetFormatter
    .formatToParts(utcMidnight)
    .find((part) => part.type === "timeZoneName")?.value;
  const suffix = offset === "GMT" ? "Z" : offset?.slice(3);
  return new Date(`${date}T00:00:00${suffix}`).toISOString();
}

export function getEnergyMixFetchRange(baseDate = new Date()): {
  from: string;
  to: string;
} {
  const today = getLondonDate(baseDate);

  return {
    from: londonMidnight(today),
    to: londonMidnight(addCalendarDays(today, MIX_DAY_COUNT))
  };
}

export function getEnergyMixTargetDates(baseDate = new Date()): string[] {
  const today = getLondonDate(baseDate);
  return Array.from({ length: MIX_DAY_COUNT }, (_, offset) =>
    addCalendarDays(today, offset)
  );
}

export function getChargingWindowRange(baseDate = new Date()): {
  from: string;
  to: string;
} {
  const now = baseDate.getTime();
  const horizon = now + CHARGING_FORECAST_HOURS * HOUR_MS;
  const start =
    Math.ceil(now / GENERATION_INTERVAL_MS) * GENERATION_INTERVAL_MS;
  const end =
    Math.floor(horizon / GENERATION_INTERVAL_MS) * GENERATION_INTERVAL_MS;

  return {
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString()
  };
}
