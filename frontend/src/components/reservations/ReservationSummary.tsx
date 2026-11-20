import type { Charger } from "../../api/reservationApi";
import { useLanguage } from "../../hooks/useLanguage";
import { londonFormatter } from "../../lib/londonDate";
import { getLondonDay, londonMidnight } from "../../lib/reservationCalendar";

export type SlotAvailability =
  "idle" | "checking" | "available" | "booked" | "error";

export const RESERVATION_FORM_ID = "charger-reservation-form";

interface Props {
  charger: Charger;
  day: string;
  start: string | null;
  end: string | null;
  duration: number;
  availability: SlotAvailability;
  disabled: boolean;
  submitting: boolean;
  reservationsError: boolean;
  onRetryAvailability: () => void;
  onRetryReservations: () => void;
}

export function ReservationSummary({
  charger,
  day,
  start,
  end,
  duration,
  availability,
  disabled,
  submitting,
  reservationsError,
  onRetryAvailability,
  onRetryReservations
}: Props) {
  const { t } = useLanguage();
  const copy = t.reservations;
  const dateFormat = londonFormatter(t.dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "short"
  });
  const endDay = end ? getLondonDay(new Date(end)) : day;
  const timeFormat = londonFormatter(t.dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: t.dateHour12
  });
  const timeRange =
    start && end
      ? `${timeFormat.format(new Date(start))}–${timeFormat.format(new Date(end))}`
      : "—";

  return (
    <section
      className="reservation-summary"
      aria-labelledby="reservation-summary-title"
    >
      <h3 id="reservation-summary-title">{copy.summary}</h3>
      <dl>
        <div>
          <dt>{copy.charger}</dt>
          <dd>
            {charger.name} · {charger.location}
          </dd>
        </div>
        <div>
          <dt>{copy.summaryDay}</dt>
          <dd>
            {dateFormat.format(new Date(londonMidnight(day)))}
            {endDay !== day &&
              ` – ${dateFormat.format(new Date(londonMidnight(endDay)))}`}
          </dd>
        </div>
        <div className="reservation-summary-time">
          <dt>{copy.summaryHours}</dt>
          <dd>{timeRange}</dd>
        </div>
        <div>
          <dt>{copy.summaryDuration}</dt>
          <dd>{duration} h</dd>
        </div>
      </dl>

      <p
        aria-live="polite"
        className="reservation-slot-status"
        data-status={availability}
      >
        {copy.slotAvailability[availability]}
      </p>
      {availability === "error" && (
        <button type="button" onClick={onRetryAvailability}>
          {t.retry}
        </button>
      )}
      {reservationsError && (
        <div className="alert alert-error retry-alert" role="alert">
          <p>{copy.bookingBlocked}</p>
          <button type="button" onClick={onRetryReservations}>
            {t.retry}
          </button>
        </div>
      )}
      <button
        className="reservation-submit"
        form={RESERVATION_FORM_ID}
        type="submit"
        disabled={disabled || availability !== "available"}
        aria-busy={submitting}
      >
        {copy.reserve}
      </button>
    </section>
  );
}
