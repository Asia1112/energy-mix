import type { Dispatch, FormEvent, Ref } from "react";
import type { Charger } from "../../api/reservationApi";
import { useLanguage } from "../../hooks/useLanguage";
import { formatLondonTime, londonFormatter } from "../../lib/londonDate";
import { RESERVATION_FORM_ID } from "./ReservationSummary";
import { DURATIONS } from "./reservationState";
import type {
  ReservationAction,
  ReservationFormState
} from "./reservationState";

interface Props {
  chargers: Charger[];
  chargerId: string;
  chargerSelect: Ref<HTMLSelectElement>;
  startTimes: string[];
  state: ReservationFormState;
  dispatch: Dispatch<ReservationAction>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ReservationForm({
  chargers,
  chargerId,
  chargerSelect,
  startTimes,
  state,
  dispatch,
  onSubmit
}: Props) {
  const { t } = useLanguage();
  const copy = t.reservations;
  const { startAt, duration } = state;
  const labels = startTimes.map((time) =>
    formatLondonTime(time, t.dateLocale, t.dateHour12)
  );
  // Only the night the clocks go back repeats a time; the zone tells them apart.
  const zoneFormat = londonFormatter(t.dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: t.dateHour12,
    timeZoneName: "short"
  });
  const timeLabel = (time: string, index: number) =>
    labels.indexOf(labels[index]) === labels.lastIndexOf(labels[index])
      ? labels[index]
      : zoneFormat.format(new Date(time));
  return (
    <form
      id={RESERVATION_FORM_ID}
      className="reservation-form"
      onSubmit={onSubmit}
    >
      <label className="field">
        {copy.charger}
        <select
          ref={chargerSelect}
          value={chargerId}
          onChange={(event) =>
            dispatch({ type: "charger", id: event.target.value })
          }
        >
          {chargers.map((charger) => (
            <option key={charger.id} value={charger.id}>
              {charger.name} · {charger.location}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {copy.time}
        <select
          value={startTimes.includes(startAt) ? startAt : ""}
          onChange={(event) =>
            dispatch({ type: "start", time: event.target.value })
          }
          required
        >
          <option value="">
            {startTimes.length ? copy.chooseTime : copy.noTimes}
          </option>
          {startTimes.map((time, index) => (
            <option key={time} value={time}>
              {timeLabel(time, index)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {copy.duration}
        <select
          value={duration}
          onChange={(event) =>
            dispatch({ type: "duration", hours: Number(event.target.value) })
          }
        >
          {DURATIONS.map((hours) => (
            <option key={hours} value={hours}>
              {hours} {copy.hours}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
