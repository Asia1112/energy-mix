export const LONDON_TIME_ZONE = "Europe/London";

const zoneFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  timeZoneName: "short"
});

export function formatLondonDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: LONDON_TIME_ZONE,
    dateStyle: "short"
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatLondonZone(instant: Date): string {
  return (
    zoneFormatter
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ?? LONDON_TIME_ZONE
  );
}

export function formatLondonTime(
  date: string,
  locale: string,
  hour12: boolean
): string {
  const instant = new Date(date);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: LONDON_TIME_ZONE,
    timeStyle: "short",
    hour12
  }).format(instant);
  return `${time} ${formatLondonZone(instant)}`;
}

export function formatLondonDateTime(
  date: string,
  locale: string,
  hour12: boolean
): string {
  const instant = new Date(date);
  const dateTime = new Intl.DateTimeFormat(locale, {
    timeZone: LONDON_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
    hour12
  }).format(instant);
  return `${dateTime} ${formatLondonZone(instant)}`;
}
