import type { Booking } from "../../api/reservationApi";
import type { ReservationTranslations } from "../../i18n/reservationTranslations";
import {
  formatLondonDateTime,
  formatLondonDay,
  LONDON_TIME_ZONE
} from "../../lib/londonDate";
import {
  addCalendarDays,
  addCalendarMonths,
  getWeekStart,
  londonMidnight,
  WEEK_DAYS
} from "../../lib/reservationCalendar";
import type { CalendarView } from "../../lib/reservationCalendar";

interface Props {
  today: string;
  day: string;
  view: CalendarView;
  periodStart: string;
  periodEnd: string;
  bookings: Booking[] | null;
  locale: string;
  hour12: boolean;
  t: ReservationTranslations;
  onChooseDay: (day: string) => void;
  onBrowseDay: (day: string) => void;
  onChangeView: (view: CalendarView) => void;
}

export function ReservationCalendar({
  today,
  day,
  view,
  periodStart,
  periodEnd,
  bookings,
  locale,
  hour12,
  t,
  onChooseDay,
  onBrowseDay,
  onChangeView
}: Props) {
  const isMonth = view === "month";
  const gridStart = getWeekStart(periodStart);
  const weekdays = Array.from({ length: WEEK_DAYS }, (_, offset) =>
    addCalendarDays(gridStart, offset)
  );
  const dates = [];
  for (
    let date = periodStart;
    date < periodEnd;
    date = addCalendarDays(date, 1)
  ) {
    dates.push(date);
  }
  const weekdayFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: LONDON_TIME_ZONE,
    weekday: "short"
  });
  const monthLabel = new Intl.DateTimeFormat(locale, {
    timeZone: LONDON_TIME_ZONE,
    month: "long",
    year: "numeric"
  }).format(new Date(londonMidnight(periodStart)));

  function formatWeekday(date: string) {
    return weekdayFormatter.format(new Date(londonMidnight(date)));
  }

  function movePeriod(direction: -1 | 1) {
    onBrowseDay(
      isMonth
        ? addCalendarMonths(periodStart, direction)
        : addCalendarDays(day, direction * WEEK_DAYS)
    );
  }

  function bookingsOn(date: string) {
    const from = Date.parse(londonMidnight(date));
    const to = Date.parse(londonMidnight(addCalendarDays(date, 1)));
    return (bookings ?? []).filter(
      (booking) =>
        Date.parse(booking.startAt) < to && Date.parse(booking.endAt) > from
    );
  }

  const selectedBookings = bookingsOn(day);

  return (
    <section className="reservation-calendar">
      <div className="reservation-calendar-header">
        <h3>{t.availability}</h3>
        <div
          className="reservation-calendar-views"
          role="group"
          aria-label={t.calendarView}
        >
          <button
            type="button"
            aria-pressed={!isMonth}
            onClick={() => onChangeView("week")}
          >
            {t.week}
          </button>
          <button
            type="button"
            aria-pressed={isMonth}
            onClick={() => onChangeView("month")}
          >
            {t.month}
          </button>
        </div>
      </div>
      <div className="reservation-calendar-header reservation-period-header">
        <p aria-live="polite">
          {isMonth
            ? monthLabel
            : `${formatLondonDay(periodStart, locale)} – ${formatLondonDay(addCalendarDays(periodEnd, -1), locale)}`}
        </p>
        <div className="reservation-week-controls">
          <button
            type="button"
            aria-label={isMonth ? t.previousMonth : t.previousWeek}
            onClick={() => movePeriod(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={isMonth ? t.nextMonth : t.nextWeek}
            onClick={() => movePeriod(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div
        className={
          isMonth ? "reservation-week reservation-month" : "reservation-week"
        }
      >
        {isMonth &&
          weekdays.map((date) => (
            <span className="reservation-weekday" key={date} aria-hidden="true">
              {formatWeekday(date)}
            </span>
          ))}
        {dates.map((date) => {
          const count = bookingsOn(date).length;
          const isPast = date < today;
          return (
            <button
              key={date}
              type="button"
              aria-label={`${formatLondonDay(date, locale)}${isPast ? `, ${t.pastDay}` : ""}${count ? `, ${t.booked}: ${count}` : ""}`}
              aria-pressed={date === day}
              aria-current={date === today ? "date" : undefined}
              data-past={isPast ? "" : undefined}
              style={
                isMonth && date === periodStart
                  ? { gridColumnStart: weekdays.indexOf(date) + 1 }
                  : undefined
              }
              onClick={() => onChooseDay(date)}
            >
              {!isMonth && <span>{formatWeekday(date)}</span>}
              <strong>{Number(date.slice(-2))}</strong>
              {count > 0 && (
                <span className="reservation-booked-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {bookings && (
        <div className="reservation-day-bookings">
          <strong>{formatLondonDay(day, locale)}</strong>
          {day < today && <p>{t.pastDayDetails}</p>}
          {selectedBookings.length > 0 ? (
            <ul>
              {selectedBookings.map(({ startAt, endAt }) => (
                <li key={startAt}>
                  <span className="reservation-booked-dot" aria-hidden="true" />
                  {t.booked} · {formatLondonDateTime(startAt, locale, hour12)} –{" "}
                  {formatLondonDateTime(endAt, locale, hour12)}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t.free}</p>
          )}
        </div>
      )}
    </section>
  );
}
