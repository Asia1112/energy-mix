import {
  getChargingWindowRange,
  getEnergyMixFetchRange,
  getEnergyMixTargetDates
} from "../src/services/date.service";

describe("date service", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses the London calendar date after 23:00 UTC in summer", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T23:30:00Z"));

    expect(getEnergyMixTargetDates()).toEqual([
      "2026-07-04",
      "2026-07-05",
      "2026-07-06"
    ]);
    expect(getEnergyMixFetchRange()).toEqual({
      from: "2026-07-03T23:00:00.000Z",
      to: "2026-07-06T23:00:00.000Z"
    });
  });

  it("uses the correct midnight offsets across the start of British Summer Time", () => {
    expect(getEnergyMixFetchRange(new Date("2026-03-29T12:00:00Z"))).toEqual({
      from: "2026-03-29T00:00:00.000Z",
      to: "2026-03-31T23:00:00.000Z"
    });
  });

  it("searches complete future slots within the next 48 hours", () => {
    expect(getChargingWindowRange(new Date("2026-07-17T09:12:00Z"))).toEqual({
      from: "2026-07-17T09:30:00.000Z",
      to: "2026-07-19T09:00:00.000Z"
    });
  });

  it("includes the current slot when now falls exactly on its boundary", () => {
    expect(getChargingWindowRange(new Date("2026-07-17T09:00:00Z"))).toEqual({
      from: "2026-07-17T09:00:00.000Z",
      to: "2026-07-19T09:00:00.000Z"
    });
  });
});
