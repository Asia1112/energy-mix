import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { FormEvent, Ref } from "react";
import type { ChargingWindowResult } from "../../api/energyApi";
import {
  bookReservation,
  cancelReservation,
  getBookings,
  getChargers,
  getReservations,
  reservationErrorStatus
} from "../../api/reservationApi";
import { useReservationQuery } from "../../hooks/useReservationQuery";
import type { Language, Translations } from "../../i18n/i18n";
import { reservationTranslations } from "../../i18n/reservationTranslations";
import {
  formatLondonDateTime,
  formatLondonDay,
  formatLondonTime
} from "../../lib/londonDate";
import {
  addCalendarDays,
  addCalendarMonths,
  getLondonDay,
  getMonthStart,
  getStartTimes,
  getWeekStart,
  londonMidnight,
  parseReservationDate,
  WEEK_DAYS
} from "../../lib/reservationCalendar";
import type { CalendarView } from "../../lib/reservationCalendar";
import { ReservationCalendar } from "./ReservationCalendar";
import "./reservations.css";

const DURATIONS = [1, 2, 3, 4, 5, 6];
const HOUR_MS = 60 * 60_000;

type Feedback =
  | "created"
  | "removed"
  | "occupied"
  | "invalidTime"
  | "createError"
  | "cancelError"
  | "sessionError";

interface Props {
  language: Language;
  t: Translations;
  ref?: Ref<ReservationsHandle>;
}

export interface ReservationsHandle {
  prefill: (result: ChargingWindowResult) => void;
}

function loadPeriodBookings(
  signal: AbortSignal,
  chargerId: string,
  periodStart: string,
  periodEnd: string
) {
  return getBookings(
    chargerId,
    londonMidnight(periodStart),
    londonMidnight(periodEnd),
    signal
  );
}

export function ReservationsSection({ language, t, ref }: Props) {
  const copy = reservationTranslations[language];
  const chargerSelect = useRef<HTMLSelectElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [selectedCharger, setSelectedCharger] = useState("");
  const [day, setDay] = useState(() => getLondonDay(new Date()));
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  const [dateInvalid, setDateInvalid] = useState(false);
  const [browsedDay, setBrowsedDay] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const chargers = useReservationQuery(getChargers);
  const mine = useReservationQuery(getReservations);
  const chargerId = selectedCharger || chargers.data?.[0]?.id || "";
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = getLondonDay(new Date(now));
  const selectedDay = day < today ? today : day;
  const calendarDay = browsedDay ?? selectedDay;
  const periodStart =
    calendarView === "month"
      ? getMonthStart(calendarDay)
      : getWeekStart(calendarDay);
  const periodEnd =
    calendarView === "month"
      ? addCalendarMonths(periodStart, 1)
      : addCalendarDays(periodStart, WEEK_DAYS);
  const bookings = useReservationQuery(
    chargerId ? loadPeriodBookings : null,
    chargerId,
    periodStart,
    periodEnd
  );
  const startTimes = getStartTimes(selectedDay, now);
  const formatDateTime = (date: string) =>
    formatLondonDateTime(date, t.dateLocale, t.dateHour12);

  useImperativeHandle(
    ref,
    () => ({
      prefill(result) {
        (chargerSelect.current ?? title.current)?.focus();

        const start = new Date(result.start);
        const hours = (Date.parse(result.end) - start.getTime()) / HOUR_MS;
        if (!DURATIONS.includes(hours)) {
          setFeedback("invalidTime");
          return;
        }

        const date = getLondonDay(start);
        const time = start.toISOString();
        if (!getStartTimes(date, Date.now()).includes(time)) {
          setFeedback("invalidTime");
          return;
        }

        setDay(date);
        setDateDraft(null);
        setDateInvalid(false);
        setStartAt(time);
        setDuration(hours);
        setBrowsedDay(null);
        setFeedback(null);
      }
    }),
    []
  );

  function chooseDay(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setDay(date < today ? today : date);
    setDateDraft(null);
    setDateInvalid(false);
    setBrowsedDay(null);
    setStartAt("");
    setFeedback(null);
  }

  function commitDate() {
    if (dateDraft === null) return;
    const date = parseReservationDate(dateDraft);
    if (!date || date < today) {
      setDateInvalid(true);
      return;
    }

    if (date !== selectedDay) chooseDay(date);
    else {
      setDateDraft(null);
      setDateInvalid(false);
    }
  }

  function chooseCalendarDay(date: string) {
    if (date < today) setBrowsedDay(date);
    else chooseDay(date);
  }

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chargerId || pending || mine.loading || mine.error) return;
    if (dateDraft !== null) {
      commitDate();
      return;
    }
    if (!startTimes.includes(startAt)) {
      setFeedback("invalidTime");
      return;
    }

    setPending("create");
    setFeedback(null);
    try {
      await bookReservation({ chargerId, startAt, durationHours: duration });
      setFeedback("created");
      mine.reload();
      bookings.reload();
    } catch (error) {
      switch (reservationErrorStatus(error)) {
        case 400:
          setFeedback("invalidTime");
          break;
        case 409:
          setFeedback("occupied");
          bookings.reload();
          break;
        case 401:
          setFeedback("sessionError");
          break;
        default:
          setFeedback("createError");
      }
    } finally {
      setPending(null);
    }
  }

  async function handleCancel(id: string) {
    if (pending) return;
    setPending(id);
    setFeedback(null);
    try {
      await cancelReservation(id);
      setFeedback("removed");
      mine.reload();
      bookings.reload();
    } catch (error) {
      setFeedback(
        reservationErrorStatus(error) === 401 ? "sessionError" : "cancelError"
      );
    } finally {
      setPending(null);
    }
  }

  const success = feedback === "created" || feedback === "removed";

  return (
    <section
      className="card reservations-panel"
      aria-labelledby="reservations-title"
    >
      <h2 id="reservations-title" tabIndex={-1} ref={title}>
        {copy.title}
      </h2>

      {chargers.loading && <p aria-live="polite">{copy.loading}</p>}
      {chargers.error && (
        <div className="alert alert-error retry-alert">
          <p>{copy.loadingChargersError}</p>
          <button type="button" onClick={chargers.reload}>
            {t.retry}
          </button>
        </div>
      )}
      {chargers.data?.length === 0 && <p>{copy.noChargers}</p>}

      {chargerId && (
        <>
          <form className="reservation-form" onSubmit={handleBook}>
            <label className="field">
              {copy.charger}
              <select
                ref={chargerSelect}
                value={chargerId}
                onChange={(event) => {
                  setSelectedCharger(event.target.value);
                  setFeedback(null);
                }}
              >
                {chargers.data?.map((charger) => (
                  <option key={charger.id} value={charger.id}>
                    {charger.name} · {charger.location}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {copy.date}
              <input
                type="text"
                inputMode="numeric"
                size={10}
                placeholder={copy.dateFormat}
                value={dateDraft ?? formatLondonDay(selectedDay, t.dateLocale)}
                aria-invalid={dateInvalid || undefined}
                aria-describedby={
                  dateInvalid ? "reservation-date-error" : undefined
                }
                onChange={(event) => {
                  setDateDraft(event.target.value);
                  setDateInvalid(false);
                }}
                onBlur={commitDate}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && dateDraft !== null) {
                    event.preventDefault();
                    commitDate();
                  }
                }}
              />
            </label>
            <label className="field">
              {copy.time}
              <select
                value={startTimes.includes(startAt) ? startAt : ""}
                onChange={(event) => setStartAt(event.target.value)}
                required
              >
                <option value="">
                  {startTimes.length ? copy.chooseTime : copy.noTimes}
                </option>
                {startTimes.map((time) => (
                  <option key={time} value={time}>
                    {formatLondonTime(time, t.dateLocale, t.dateHour12)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {copy.duration}
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                {DURATIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} {copy.hours}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="reservation-submit"
              type="submit"
              disabled={
                pending !== null ||
                mine.loading ||
                mine.error ||
                startTimes.length === 0
              }
              aria-busy={pending === "create"}
            >
              {copy.reserve}
            </button>
          </form>
          {dateInvalid && (
            <p
              id="reservation-date-error"
              className="alert alert-error"
              role="alert"
            >
              {copy.invalidDate}
            </p>
          )}

          <ReservationCalendar
            today={today}
            day={calendarDay}
            view={calendarView}
            periodStart={periodStart}
            periodEnd={periodEnd}
            bookings={bookings.data}
            locale={t.dateLocale}
            hour12={t.dateHour12}
            t={copy}
            onChooseDay={chooseCalendarDay}
            onBrowseDay={setBrowsedDay}
            onChangeView={setCalendarView}
          />
          {bookings.loading && <p aria-live="polite">{copy.loading}</p>}
          {bookings.error && (
            <div className="alert alert-error retry-alert">
              <p>{copy.loadingBookingsError}</p>
              <button type="button" onClick={bookings.reload}>
                {t.retry}
              </button>
            </div>
          )}
        </>
      )}

      {feedback && (
        <p
          className={success ? "reservation-success" : "alert alert-error"}
          role={success ? "status" : "alert"}
        >
          {copy[feedback]}
        </p>
      )}

      <section className="reservation-history">
        <h3>{copy.mine}</h3>
        {mine.loading && <p aria-live="polite">{copy.loading}</p>}
        {mine.error && (
          <div className="alert alert-error retry-alert">
            <p>{copy.loadingReservationsError}</p>
            <button type="button" onClick={mine.reload}>
              {t.retry}
            </button>
          </div>
        )}
        {mine.data?.length === 0 && <p>{copy.empty}</p>}
        {mine.data && mine.data.length > 0 && (
          <ul className="reservation-list">
            {mine.data.map((reservation) => {
              const charger = chargers.data?.find(
                ({ id }) => id === reservation.chargerId
              );
              return (
                <li key={reservation.id}>
                  <div>
                    <strong>{charger?.name ?? reservation.chargerId}</strong>
                    {charger && <span> · {charger.location}</span>}
                    <p>
                      {formatDateTime(reservation.startAt)} –{" "}
                      {formatDateTime(reservation.endAt)}
                    </p>
                  </div>
                  {reservation.cancelledAt ? (
                    <span className="reservation-state">{copy.cancelled}</span>
                  ) : Date.parse(reservation.endAt) <= now ? (
                    <span className="reservation-state">{copy.completed}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending !== null}
                      aria-busy={pending === reservation.id}
                      onClick={() => void handleCancel(reservation.id)}
                    >
                      {copy.cancel}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
