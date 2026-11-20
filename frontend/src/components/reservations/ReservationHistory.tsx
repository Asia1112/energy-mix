import type { UseQueryResult } from "@tanstack/react-query";
import type { Charger, Reservation } from "../../api/reservationApi";
import { useLanguage } from "../../hooks/useLanguage";
import { formatLondonDateTime } from "../../lib/londonDate";

interface Props {
  chargers: Charger[];
  mine: UseQueryResult<Reservation[]>;
  now: number;
  pending: string | null;
  onCancel: (id: string) => void;
}

function getReservationStatus(reservation: Reservation, now: number) {
  if (reservation.cancelledAt) return "cancelled";
  if (Date.parse(reservation.endAt) <= now) return "completed";
  if (Date.parse(reservation.startAt) <= now) return "inProgress";
  return null;
}

export function ReservationHistory({
  chargers,
  mine,
  now,
  pending,
  onCancel
}: Props) {
  const { t } = useLanguage();
  const copy = t.reservations;
  const formatDateTime = (date: string) =>
    formatLondonDateTime(date, t.dateLocale, t.dateHour12);
  return (
    <section className="reservation-history">
      <h3>{copy.mine}</h3>
      {mine.isLoading && <p aria-live="polite">{copy.loading}</p>}
      {mine.error && (
        <div className="alert alert-error retry-alert">
          <p>{copy.loadingReservationsError}</p>
          <button type="button" onClick={() => void mine.refetch()}>
            {t.retry}
          </button>
        </div>
      )}
      {mine.data?.length === 0 && <p>{copy.empty}</p>}
      {mine.data && mine.data.length > 0 && (
        <ul className="reservation-list">
          {mine.data.map((reservation) => {
            const charger = chargers.find(
              ({ id }) => id === reservation.chargerId
            );
            const status = getReservationStatus(reservation, now);
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
                {status ? (
                  <span className="reservation-state">{copy[status]}</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending !== null}
                    aria-busy={pending === reservation.id}
                    onClick={() => onCancel(reservation.id)}
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
  );
}
