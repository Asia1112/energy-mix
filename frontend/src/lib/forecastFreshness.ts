const FORECAST_INTERVAL_MS = 30 * 60_000;

// Forecasts change per half-hour interval, so data stays fresh until the next one.
export function untilNextForecast({
  state
}: {
  state: { dataUpdatedAt: number };
}): number {
  return FORECAST_INTERVAL_MS - (state.dataUpdatedAt % FORECAST_INTERVAL_MS);
}
