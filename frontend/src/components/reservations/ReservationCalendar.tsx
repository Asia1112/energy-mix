import type { Booking } from "../../api/reservationApi";
import { useLanguage } from "../../hooks/useLanguage";
import {
  formatLondonDateTime,
  formatLondonDay,
  londonFormatter
} from "../../lib/londonDate";
import {
  addCalendarDays,
  getDayOccupancy,
  londonMidnight,
  WEEK_DAYS
} from "../../lib/reservationCalendar";

interface Props {
  today: string;
  day: string;
  lastDay: string;
  periodStart: string;
  periodEnd: string;
  bookings: Booking[] | null;
  onChooseDay: (day: string) => void;
  onBrowseDay: (day: string) => void;
}

export function ReservationCalendar({
  today,
  day,
  lastDay,
  periodStart,
  periodEnd,
  bookings,
  onChooseDay,
  onBrowseDay
}: Props) {
  const {
    t: { reservations: copy, dateLocale: locale, dateHour12: hour12 }
  } = useLanguage();
  const dates = [];
  for (
    let date = periodStart;
    date < periodEnd;
    date = addCalendarDays(date, 1)
  ) {
    dates.push(date);
  }
  const weekdayFormatter = londonFormatter(locale, { weekday: "short" });
  const periodFormat = londonFormatter(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const weekLabel = periodFormat.formatRange(
    new Date(londonMidnight(periodStart)),
    new Date(londonMidnight(addCalendarDays(periodEnd, -1)))
  );

  function formatWeekday(date: string) {
    return weekdayFormatter.format(new Date(londonMidnight(date)));
  }

  function movePeriod(direction: -1 | 1) {
    onBrowseDay(addCalendarDays(day, direction * WEEK_DAYS));
  }

  const selectedBookings = getDayOccupancy(day, bookings ?? []).bookings;

  return (
    <section className="reservation-calendar">
      <div className="reservation-calendar-header">
        <h3>{copy.availability}</h3>
      </div>
      <div className="reservation-calendar-header reservation-period-header">
        <div className="reservation-week-controls">
          <button
            type="button"
            aria-label={copy.previousWeek}
            onClick={() => movePeriod(-1)}
          >
            ‹
          </button>
          <p aria-live="polite">{weekLabel}</p>
          <button
            type="button"
            aria-label={copy.nextWeek}
            disabled={periodEnd > lastDay}
            onClick={() => movePeriod(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="reservation-week">
        {dates.map((date) => {
          const occupancy = bookings ? getDayOccupancy(date, bookings) : null;
          const count = occupancy?.bookings.length ?? 0;
          const isPast = date < today;
          const isTooFar = date > lastDay;
          return (
            <button
              key={date}
              type="button"
              disabled={isTooFar}
              aria-label={`${formatLondonDay(date, locale)}${isPast ? `, ${copy.pastDay}` : ""}${count ? `, ${copy.booked}: ${count}` : ""}`}
              aria-description={
                occupancy
                  ? `${occupancy.percentage}% ${copy.occupancy}`
                  : undefined
              }
              aria-pressed={date === day}
              aria-current={date === today ? "date" : undefined}
              data-past={isPast ? "" : undefined}
              onClick={() => onChooseDay(date)}
            >
              <span className="reservation-day-label">
                {date === today ? copy.today : formatWeekday(date)}
              </span>
              <strong>{Number(date.slice(-2))}</strong>
              {occupancy && (
                <>
                  <span
                    className="reservation-occupancy-bar"
                    aria-hidden="true"
                  >
                    <span style={{ width: `${occupancy.percentage}%` }} />
                  </span>
                  <span
                    className="reservation-occupancy-label"
                    aria-hidden="true"
                  >
                    {occupancy.percentage}%{" "}
                    <span className="reservation-occupancy-word">
                      {copy.occupancy}
                    </span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {bookings && (
        <div className="reservation-day-bookings">
          <strong>{formatLondonDay(day, locale)}</strong>
          {day < today && <p>{copy.pastDayDetails}</p>}
          {selectedBookings.length > 0 ? (
            <ul>
              {selectedBookings.map(({ startAt, endAt }) => (
                <li key={startAt}>
                  <span className="reservation-booked-dot" aria-hidden="true" />
                  {copy.booked} ·{" "}
                  {formatLondonDateTime(startAt, locale, hour12)} –{" "}
                  {formatLondonDateTime(endAt, locale, hour12)}
                </li>
              ))}
            </ul>
          ) : (
            <p>{copy.free}</p>
          )}
        </div>
      )}
    </section>
  );
}
