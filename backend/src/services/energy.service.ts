import { GENERATION_INTERVAL_MS, getLondonDate } from "./date.service";
import type {
  ChargingWindowResult,
  DailyEnergyMix,
  FuelName,
  GenerationInterval
} from "../types/energy.types";

const CLEAN_FUELS: FuelName[] = [
  "biomass",
  "nuclear",
  "hydro",
  "wind",
  "solar"
];
const INTERVALS_PER_HOUR = 2;

export class InsufficientGenerationDataError extends Error {
  constructor() {
    super("Not enough generation data.");
    this.name = "InsufficientGenerationDataError";
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCleanEnergyPercentage(interval: GenerationInterval): number {
  return interval.generationmix
    .filter((item) => CLEAN_FUELS.includes(item.fuel))
    .reduce((sum, item) => sum + item.perc, 0);
}

function groupByLondonDay(intervals: GenerationInterval[]) {
  const days = new Map<string, GenerationInterval[]>();

  for (const interval of intervals) {
    const date = getLondonDate(new Date(interval.from));
    const day = days.get(date);
    if (day) {
      day.push(interval);
    } else {
      days.set(date, [interval]);
    }
  }

  return days;
}

function averageFuelShares(
  intervals: GenerationInterval[]
): Record<string, number> {
  const totals = new Map<FuelName, { sum: number; count: number }>();

  for (const interval of intervals) {
    for (const { fuel, perc } of interval.generationmix) {
      const total = totals.get(fuel) ?? { sum: 0, count: 0 };
      total.sum += perc;
      total.count += 1;
      totals.set(fuel, total);
    }
  }

  return Object.fromEntries(
    Array.from(totals, ([fuel, { sum, count }]) => [fuel, round(sum / count)])
  );
}

export function calculateDailyAverages(
  intervals: GenerationInterval[]
): DailyEnergyMix[] {
  return Array.from(groupByLondonDay(intervals), ([date, dayIntervals]) => {
    const mix = averageFuelShares(dayIntervals);
    const cleanEnergyPercentage = CLEAN_FUELS.reduce(
      (sum, fuel) => sum + (mix[fuel] ?? 0),
      0
    );

    return { date, mix, cleanEnergyPercentage: round(cleanEnergyPercentage) };
  });
}

export function findBestChargingWindow(
  intervals: GenerationInterval[],
  hours: number
): ChargingWindowResult {
  const requiredIntervals = hours * INTERVALS_PER_HOUR;
  const slots = intervals
    .map((interval) => ({
      interval,
      start: Date.parse(interval.from),
      end: Date.parse(interval.to)
    }))
    .filter(({ start, end }) => end - start === GENERATION_INTERVAL_MS)
    .sort((a, b) => a.start - b.start);

  let best: ChargingWindowResult | undefined;
  let bestAverage = -Infinity;

  for (let i = 0; i <= slots.length - requiredIntervals; i++) {
    const window = slots.slice(i, i + requiredIntervals);
    const first = window[0];
    const last = window[window.length - 1];
    const isContinuous = window.every(
      (slot, index) =>
        slot.start === first.start + index * GENERATION_INTERVAL_MS
    );

    if (!isContinuous) {
      continue;
    }

    const cleanEnergySum = window.reduce(
      (sum, slot) => sum + getCleanEnergyPercentage(slot.interval),
      0
    );
    const average = cleanEnergySum / requiredIntervals;
    if (average > bestAverage) {
      bestAverage = average;
      best = {
        start: first.interval.from,
        end: last.interval.to,
        averageCleanEnergyPercentage: round(average)
      };
    }
  }

  if (!best) {
    throw new InsufficientGenerationDataError();
  }

  return best;
}
