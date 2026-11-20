import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import {
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState
} from "react";
import type { FormEvent, Ref } from "react";
import type { ChargingWindowResult } from "../../api/energyApi";
import {
  bookReservation,
  cancelReservation,
  getBookings,
  getReservations,
  isReservationConfigError,
  reservationErrorCode,
  reservationErrorStatus
} from "../../api/reservationApi";
import type {
  Booking,
  Charger,
  ReservationInput
} from "../../api/reservationApi";
import { useLanguage } from "../../hooks/useLanguage";
import {
  addCalendarDays,
  getLondonDay,
  getLastBookableDay,
  getStartTimes,
  getWeekStart,
  londonMidnight,
  WEEK_DAYS
} from "../../lib/reservationCalendar";
import { ReservationCalendar } from "./ReservationCalendar";
import { ReservationForm } from "./ReservationForm";
import { ReservationHistory } from "./ReservationHistory";
import { ReservationSummary } from "./ReservationSummary";
import type { SlotAvailability } from "./ReservationSummary";
import {
  DURATIONS,
  initialReservationState,
  reservationReducer
} from "./reservationState";
import "./reservations.css";

const HOUR_MS = 60 * 60_000;
const SLOT_MS = 30 * 60_000;
const bookingsKey = ["bookings"] as const;
const reservationsKey = ["reservations"] as const;
// Others may book meanwhile; the backend still rejects conflicts with 409.
const BOOKINGS_STALE_MS = 30_000;

function getSlotAvailability(
  start: string | null,
  end: string | null,
  query: UseQueryResult<Booking[]>
): SlotAvailability {
  if (!start || !end) return "idle";
  // Background refetches keep the last known answer instead of blocking.
  if (query.isFetching && !query.data) return "checking";
  if (query.isError) return "error";
  if (!query.data) return "checking";
  const from = Date.parse(start);
  const to = Date.parse(end);
  return query.data.some(
    (booking) =>
      Date.parse(booking.startAt) < to && Date.parse(booking.endAt) > from
  )
    ? "booked"
    : "available";
}

interface Props {
  chargers: UseQueryResult<Charger[]>;
  ref?: Ref<ReservationsHandle>;
}

export interface ReservationsHandle {
  prefill: (result: ChargingWindowResult) => void;
}

export function ReservationsSection({ chargers, ref }: Props) {
  const { t } = useLanguage();
  const copy = t.reservations;
  const [state, dispatch] = useReducer(
    reservationReducer,
    undefined,
    initialReservationState
  );
  const chargerSelect = useRef<HTMLSelectElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(Date.now);

  const today = getLondonDay(new Date(now));
  const selectedDay = state.day < today ? today : state.day;
  const calendarDay = state.browsedDay ?? selectedDay;
  const lastDay = getLastBookableDay(today);
  const periodStart = getWeekStart(calendarDay);
  const periodEnd = addCalendarDays(periodStart, WEEK_DAYS);
  const chargerData = chargers.isError ? undefined : chargers.data;
  const charger =
    chargerData?.find(({ id }) => id === state.selectedCharger) ??
    chargerData?.[0];
  const chargerId = charger?.id ?? "";
  const startTimes = getStartTimes(selectedDay, now);
  const slotStart = startTimes.includes(state.startAt) ? state.startAt : null;
  const slotEnd = slotStart
    ? new Date(Date.parse(slotStart) + state.duration * HOUR_MS).toISOString()
    : null;
  const client = useQueryClient();
  const reservationsAvailable =
    !chargers.isPending && !isReservationConfigError(chargers.error);
  const mine = useQuery({
    queryKey: reservationsKey,
    queryFn: ({ signal }) => getReservations(signal),
    enabled: reservationsAvailable,
    // Only this session's own changes affect it, and they invalidate it.
    staleTime: Infinity
  });
  useEffect(() => {
    // Refresh when a half-hour start time passes so it stops being offered.
    let nextUpdate = Math.min(
      now + 30_000,
      (Math.floor(now / SLOT_MS) + 1) * SLOT_MS
    );
    for (const reservation of mine.data ?? []) {
      if (reservation.cancelledAt) continue;
      for (const boundary of [
        Date.parse(reservation.startAt),
        Date.parse(reservation.endAt)
      ]) {
        if (boundary > now) nextUpdate = Math.min(nextUpdate, boundary);
      }
    }

    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, nextUpdate - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [mine.data, now]);
  const periodFrom = londonMidnight(periodStart);
  const periodTo = londonMidnight(periodEnd);
  const bookings = useQuery({
    queryKey: [...bookingsKey, chargerId, periodStart, periodEnd],
    queryFn: ({ signal }) =>
      getBookings(chargerId, periodFrom, periodTo, signal),
    enabled: Boolean(chargerId),
    staleTime: BOOKINGS_STALE_MS
  });
  // The loaded week answers availability unless the slot lies outside it.
  const slotInPeriod =
    slotStart !== null &&
    slotEnd !== null &&
    Date.parse(slotStart) >= Date.parse(periodFrom) &&
    Date.parse(slotEnd) <= Date.parse(periodTo);
  const slot = useQuery({
    queryKey: [...bookingsKey, chargerId, "slot", slotStart, slotEnd],
    queryFn:
      chargerId && slotStart && slotEnd && !slotInPeriod
        ? ({ signal }) => getBookings(chargerId, slotStart, slotEnd, signal)
        : skipToken,
    staleTime: BOOKINGS_STALE_MS
  });
  const availabilityQuery = slotInPeriod ? bookings : slot;
  const availability = getSlotAvailability(
    slotStart,
    slotEnd,
    availabilityQuery
  );

  function refreshReservations() {
    return Promise.all([
      client.invalidateQueries({ queryKey: reservationsKey }),
      client.invalidateQueries({ queryKey: bookingsKey })
    ]);
  }

  const create = useMutation({
    mutationFn: (input: ReservationInput) => bookReservation(input),
    onMutate: () => dispatch({ type: "feedback", feedback: null }),
    onSuccess: () => {
      dispatch({ type: "feedback", feedback: "created" });
      return refreshReservations();
    },
    onError: (error) => {
      switch (reservationErrorStatus(error)) {
        case 400:
          dispatch({
            type: "feedback",
            feedback:
              reservationErrorCode(error) === "TOO_FAR_AHEAD"
                ? "tooFar"
                : "invalidTime"
          });
          break;
        case 409:
          dispatch({ type: "feedback", feedback: "occupied" });
          return client.invalidateQueries({ queryKey: bookingsKey });
        case 401:
          dispatch({ type: "feedback", feedback: "sessionError" });
          break;
        default:
          dispatch({ type: "feedback", feedback: "createError" });
      }
    }
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onMutate: () => dispatch({ type: "feedback", feedback: null }),
    onSuccess: () => {
      dispatch({ type: "feedback", feedback: "removed" });
      return refreshReservations();
    },
    onError: (error) => {
      const status = reservationErrorStatus(error);
      if (status === 409) {
        dispatch({ type: "feedback", feedback: "startedCancel" });
        return client.invalidateQueries({ queryKey: reservationsKey });
      }
      dispatch({
        type: "feedback",
        feedback: status === 401 ? "sessionError" : "cancelError"
      });
    }
  });
  const pending = create.isPending
    ? "create"
    : cancel.isPending
      ? (cancel.variables ?? null)
      : null;

  useImperativeHandle(
    ref,
    () => ({
      prefill(result) {
        (chargerSelect.current ?? title.current)?.focus();

        const start = new Date(result.start);
        const hours = (Date.parse(result.end) - start.getTime()) / HOUR_MS;
        if (!DURATIONS.includes(hours)) {
          dispatch({ type: "feedback", feedback: "invalidTime" });
          return;
        }

        const day = getLondonDay(start);
        const time = start.toISOString();
        if (day > getLastBookableDay(getLondonDay(new Date()))) {
          dispatch({ type: "feedback", feedback: "tooFar" });
          return;
        }
        if (!getStartTimes(day, Date.now()).includes(time)) {
          dispatch({ type: "feedback", feedback: "invalidTime" });
          return;
        }

        dispatch({ type: "prefill", day, time, hours });
      }
    }),
    []
  );

  function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chargerId || pending || mine.isPending || mine.isError) return;
    if (!slotStart || !slotEnd || Date.parse(slotStart) <= Date.now()) {
      setNow(Date.now());
      dispatch({ type: "feedback", feedback: "invalidTime" });
      return;
    }
    if (getLondonDay(new Date(Date.parse(slotEnd) - 1)) > lastDay) {
      dispatch({ type: "feedback", feedback: "tooFar" });
      return;
    }
    if (availability !== "available") return;

    create.mutate({
      chargerId,
      startAt: slotStart,
      durationHours: state.duration
    });
  }

  const { feedback } = state;
  const success = feedback === "created" || feedback === "removed";

  return (
    <section
      className="card reservations-panel"
      aria-labelledby="reservations-title"
    >
      <h2 id="reservations-title" tabIndex={-1} ref={title}>
        {copy.title}
      </h2>

      {chargers.isLoading && <p aria-live="polite">{copy.loading}</p>}
      {chargers.isError && (
        <div className="alert alert-error retry-alert" role="alert">
          <p>
            {isReservationConfigError(chargers.error)
              ? copy.missingConfig
              : copy.loadingChargersError}
          </p>
          <button type="button" onClick={() => void chargers.refetch()}>
            {t.retry}
          </button>
        </div>
      )}
      {chargerData?.length === 0 && <p>{copy.noChargers}</p>}

      {chargerData && charger && (
        <div className="reservation-workspace">
          <div className="reservation-schedule">
            <ReservationForm
              chargers={chargerData}
              chargerId={chargerId}
              chargerSelect={chargerSelect}
              startTimes={startTimes}
              state={state}
              dispatch={dispatch}
              onSubmit={handleBook}
            />
            <ReservationCalendar
              today={today}
              lastDay={lastDay}
              day={calendarDay}
              periodStart={periodStart}
              periodEnd={periodEnd}
              bookings={bookings.data ?? null}
              onChooseDay={(day) =>
                dispatch(
                  day < today
                    ? { type: "browseDay", day }
                    : { type: "chooseDay", day }
                )
              }
              onBrowseDay={(day) => dispatch({ type: "browseDay", day })}
            />
            {bookings.isLoading && <p aria-live="polite">{copy.loading}</p>}
            {bookings.isError && (
              <div className="alert alert-error retry-alert">
                <p>{copy.loadingBookingsError}</p>
                <button type="button" onClick={() => void bookings.refetch()}>
                  {t.retry}
                </button>
              </div>
            )}
          </div>
          <ReservationSummary
            charger={charger}
            day={selectedDay}
            start={slotStart}
            end={slotEnd}
            duration={state.duration}
            availability={availability}
            disabled={pending !== null || mine.isPending || mine.isError}
            submitting={create.isPending}
            reservationsError={mine.isError}
            onRetryAvailability={() => void availabilityQuery.refetch()}
            onRetryReservations={() => void mine.refetch()}
          />
        </div>
      )}

      {feedback && (
        <p
          className={success ? "reservation-success" : "alert alert-error"}
          role={success ? "status" : "alert"}
        >
          {copy[feedback]}
        </p>
      )}

      {reservationsAvailable && (
        <ReservationHistory
          chargers={chargerData ?? []}
          mine={mine}
          now={now}
          pending={pending}
          onCancel={(id) => cancel.mutate(id)}
        />
      )}
    </section>
  );
}
