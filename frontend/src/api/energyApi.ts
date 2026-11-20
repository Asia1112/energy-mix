import { api } from "./apiClient";

export interface DailyEnergyMix {
  date: string;
  mix: Record<string, number>;
  cleanEnergyPercentage: number;
}

export interface ChargingWindowResult {
  start: string;
  end: string;
  averageCleanEnergyPercentage: number;
}

export async function getEnergyMix(
  signal: AbortSignal
): Promise<DailyEnergyMix[]> {
  const { data } = await api.get<DailyEnergyMix[]>("/energy-mix", { signal });
  if (!Array.isArray(data)) throw new Error("Invalid energy mix response");
  return data;
}

export async function getChargingWindow(
  hours: number,
  signal: AbortSignal
): Promise<ChargingWindowResult> {
  const { data } = await api.get<ChargingWindowResult>("/charging-window", {
    params: { hours },
    signal
  });
  if (!data?.start || !data.end)
    throw new Error("Invalid charging window response");
  return data;
}
