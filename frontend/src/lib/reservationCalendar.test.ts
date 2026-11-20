import { formatLondonTime } from "./londonDate";
import {
  getDayOccupancy,
  getLastBookableDay,
  getLondonDay,
  getStartTimes,
  getWeekStart,
  londonMidnight,
  moveTimeToDay
} from "./reservationCalendar";

describe("London reservation dates", () => {
  it("keeps the London clock time when moving a start to another day", () => {
    expect(moveTimeToDay("2026-07-16T10:30:00.000Z", "2026-07-20")).toBe(
      "2026-07-20T10:30:00.000Z"
    );
    // 11:30 BST on Saturday becomes 11:30 GMT after the clocks go back.
    expect(moveTimeToDay("2026-10-24T10:30:00.000Z", "2026-10-26")).toBe(
      "2026-10-26T11:30:00.000Z"
    );
    // 01:30 does not exist in London when the clocks go forward.
    expect(moveTimeToDay("2026-03-28T01:30:00.000Z", "2026-03-29")).toBe("");
    expect(moveTimeToDay("", "2026-07-20")).toBe("");
  });

  it("clips bookings to the selected day and uses its actual length during the time change", () => {
    const booking = {
      startAt: "2026-10-24T22:00:00Z",
      endAt: "2026-10-25T04:00:00Z"
    };
    expect(getDayOccupancy("2026-10-25", [booking])).toEqual({
      bookings: [booking],
      percentage: 20
    });
  });

  it("starts the week on Monday using London calendar days", () => {
    expect(getLondonDay(new Date("2026-07-05T23:30:00Z"))).toBe("2026-07-06");
    expect(getWeekStart("2026-07-06")).toBe("2026-07-06");
    expect(getWeekStart("2026-07-12")).toBe("2026-07-06");
    expect(londonMidnight("2026-07-06")).toBe("2026-07-05T23:00:00.000Z");
  });

  it("skips the missing hour in spring and keeps both occurrences in autumn", () => {
    expect(getStartTimes("2026-03-29", 0)).toHaveLength(46);

    const october = getStartTimes("2026-10-25", 0);
    expect(october).toHaveLength(50);
    const labels = october.map((time) =>
      formatLondonTime(time, "en-GB", false)
    );
    expect(labels.filter((label) => label === "01:30")).toHaveLength(2);
  });

  it("allows booking up to the same day next month, clamped to its end", () => {
    expect(getLastBookableDay("2026-07-16")).toBe("2026-08-16");
    expect(getLastBookableDay("2026-12-20")).toBe("2027-01-20");
    expect(getLastBookableDay("2026-01-31")).toBe("2026-02-28");
    expect(getLastBookableDay("2026-08-31")).toBe("2026-09-30");
  });
});
