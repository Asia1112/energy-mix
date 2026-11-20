import { api } from "./apiClient";
import { getChargingWindow, getEnergyMix } from "./energyApi";

vi.mock("./apiClient", () => ({
  api: { get: vi.fn() }
}));

const get = vi.mocked(api.get);

describe("energyApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the shared client and forwards the cancellation signal", async () => {
    const data = [
      {
        date: "2026-07-03",
        mix: { wind: 50, gas: 50 },
        cleanEnergyPercentage: 50
      }
    ];
    const { signal } = new AbortController();
    get.mockResolvedValueOnce({ data });

    await expect(getEnergyMix(signal)).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith("/energy-mix", { signal });
  });

  it("passes charging hours and the cancellation signal", async () => {
    const data = {
      start: "2026-07-04T00:00:00Z",
      end: "2026-07-04T03:00:00Z",
      averageCleanEnergyPercentage: 82.5
    };
    const { signal } = new AbortController();
    get.mockResolvedValueOnce({ data });

    await expect(getChargingWindow(3, signal)).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith("/charging-window", {
      params: { hours: 3 },
      signal
    });
  });
});
