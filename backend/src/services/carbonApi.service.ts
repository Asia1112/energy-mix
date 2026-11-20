import axios from "axios";
import type { GenerationInterval } from "../types/energy.types";
import { GENERATION_INTERVAL_MS } from "./date.service";

const DEFAULT_BASE_URL = "https://api.carbonintensity.org.uk";
const REQUEST_TIMEOUT_MS = 10000;

export class CarbonApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarbonApiError";
  }
}

interface GenerationResponse {
  data?: GenerationInterval[];
}

function isGenerationInterval(interval: GenerationInterval): boolean {
  return (
    typeof interval?.from === "string" &&
    typeof interval.to === "string" &&
    Number.isFinite(Date.parse(interval.from)) &&
    Number.isFinite(Date.parse(interval.to)) &&
    Array.isArray(interval.generationmix) &&
    interval.generationmix.length > 0 &&
    interval.generationmix.every(
      (item) => typeof item?.fuel === "string" && Number.isFinite(item.perc)
    )
  );
}

interface CacheEntry {
  expiresAt: number;
  data: Promise<GenerationInterval[]>;
}

// Forecasts change per half-hour interval, so responses are reused until the next one.
const cache = new Map<string, CacheEntry>();

export function clearGenerationMixCache(): void {
  cache.clear();
}

export function fetchGenerationMix(
  from: string,
  to: string
): Promise<GenerationInterval[]> {
  const baseUrl = process.env.CARBON_API_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl.replace(/\/$/, "")}/generation/${from}/${to}`;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }

  const cached = cache.get(url);
  if (cached) {
    return cached.data;
  }

  const entry: CacheEntry = {
    expiresAt:
      (Math.floor(now / GENERATION_INTERVAL_MS) + 1) * GENERATION_INTERVAL_MS,
    data: requestGenerationMix(url)
  };
  cache.set(url, entry);
  entry.data.catch(() => {
    if (cache.get(url) === entry) cache.delete(url);
  });
  return entry.data;
}

async function requestGenerationMix(
  url: string
): Promise<GenerationInterval[]> {
  const response = await axios
    .get<GenerationResponse>(url, { timeout: REQUEST_TIMEOUT_MS })
    .catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        const reason = error.response?.status ?? error.code ?? error.message;
        throw new CarbonApiError(`Carbon Intensity request failed: ${reason}`);
      }
      throw error;
    });

  const data = response.data?.data;
  if (!Array.isArray(data) || !data.every(isGenerationInterval)) {
    throw new CarbonApiError("Invalid Carbon Intensity generation response.");
  }

  return data;
}
