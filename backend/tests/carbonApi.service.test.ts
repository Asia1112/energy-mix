import axios from "axios";
import {
  CarbonApiError,
  clearGenerationMixCache,
  fetchGenerationMix
} from "../src/services/carbonApi.service";
import type { GenerationInterval } from "../src/types/energy.types";

jest.mock("axios");

const mockedAxios = jest.mocked(axios);

describe("fetchGenerationMix", () => {
  const originalCarbonApiBaseUrl = process.env.CARBON_API_BASE_URL;

  beforeEach(() => {
    delete process.env.CARBON_API_BASE_URL;
    mockedAxios.get.mockReset();
    clearGenerationMixCache();
  });

  afterEach(() => {
    process.env.CARBON_API_BASE_URL = originalCarbonApiBaseUrl;
    jest.useRealTimers();
  });

  it("reuses a response until the next half-hour interval and retries after errors", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:10:00Z"));
    const from = "2026-07-03T12:30:00Z";
    const to = "2026-07-05T12:00:00Z";
    mockedAxios.get
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ data: { data: [] } });

    await expect(fetchGenerationMix(from, to)).rejects.toThrow();
    await Promise.all([
      fetchGenerationMix(from, to),
      fetchGenerationMix(from, to)
    ]);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    jest.setSystemTime(new Date("2026-07-03T12:29:59Z"));
    await fetchGenerationMix(from, to);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    jest.setSystemTime(new Date("2026-07-03T12:30:00Z"));
    await fetchGenerationMix(from, to);
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it("requests the Carbon Intensity generation endpoint with timeout", async () => {
    const intervals: GenerationInterval[] = [
      {
        from: "2026-07-03T00:00:00Z",
        to: "2026-07-03T00:30:00Z",
        generationmix: [
          { fuel: "wind", perc: 30 },
          { fuel: "gas", perc: 70 }
        ]
      }
    ];

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: intervals
      }
    });

    await expect(
      fetchGenerationMix("2026-07-03T00:00:00Z", "2026-07-04T00:00:00Z")
    ).resolves.toEqual(intervals);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://api.carbonintensity.org.uk/generation/2026-07-03T00:00:00Z/2026-07-04T00:00:00Z",
      {
        timeout: 10000
      }
    );
  });

  it("rejects an unexpected response shape", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { data: [{ from: "2026-07-03T00:00:00Z" }] }
    });

    await expect(
      fetchGenerationMix("2026-07-03T00:00:00Z", "2026-07-04T00:00:00Z")
    ).rejects.toThrow(CarbonApiError);
  });

  it("uses CARBON_API_BASE_URL when it is configured", async () => {
    process.env.CARBON_API_BASE_URL = "https://carbon.example.test/";
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: []
      }
    });

    await fetchGenerationMix("2026-07-03T00:00:00Z", "2026-07-04T00:00:00Z");

    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://carbon.example.test/generation/2026-07-03T00:00:00Z/2026-07-04T00:00:00Z",
      {
        timeout: 10000
      }
    );
  });
});
