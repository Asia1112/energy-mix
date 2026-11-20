export const LONDON_TIME_ZONE = "Europe/London";

const formatters = new Map<string, Intl.DateTimeFormat>();

// Intl formatters are costly to build, so they are cached.
export function londonFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: LONDON_TIME_ZONE
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatLondonDay(date: string, locale: string): string {
  return londonFormatter(locale, { dateStyle: "short" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

export function formatLondonTime(
  date: string,
  locale: string,
  hour12: boolean
): string {
  return londonFormatter(locale, { timeStyle: "short", hour12 }).format(
    new Date(date)
  );
}

export function formatLondonDateTime(
  date: string,
  locale: string,
  hour12: boolean
): string {
  return londonFormatter(locale, {
    dateStyle: "short",
    timeStyle: "short",
    hour12
  }).format(new Date(date));
}
