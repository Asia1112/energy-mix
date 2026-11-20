import { formatLondonTime } from "./londonDate";
import {
  getLondonDay,
  getStartTimes,
  getWeekStart,
  londonMidnight
} from "./reservationCalendar";

describe("London reservation dates", () => {
  it("starts the week on Monday using London calendar days", () => {
    expect(getLondonDay(new Date("2026-07-05T23:30:00Z"))).toBe("2026-07-06");
    expect(getWeekStart("2026-07-06")).toBe("2026-07-06");
    expect(getWeekStart("2026-07-12")).toBe("2026-07-06");
    expect(londonMidnight("2026-07-06")).toBe("2026-07-05T23:00:00.000Z");
  });

  it("skips the missing hour in spring and distinguishes both occurrences in autumn", () => {
    expect(getStartTimes("2026-03-29", 0)).toHaveLength(46);

    const october = getStartTimes("2026-10-25", 0);
    expect(october).toHaveLength(50);
    const labels = october.map((time) =>
      formatLondonTime(time, "en-GB", false)
    );
    expect(labels).toContain("01:30 BST");
    expect(labels).toContain("01:30 GMT");
  });
});
