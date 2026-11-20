import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getChargingWindow } from "../../api/energyApi";
import type { ChargingWindowResult } from "../../api/energyApi";
import { useLanguage } from "../../hooks/useLanguage";
import { untilNextForecast } from "../../lib/forecastFreshness";
import { formatLondonDateTime } from "../../lib/londonDate";

interface Props {
  onReserveWindow?: (result: ChargingWindowResult) => void;
}

export function ChargingForm({ onReserveWindow }: Props) {
  const { t } = useLanguage();
  const [hours, setHours] = useState("3");
  const [requestedHours, setRequestedHours] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const query = useQuery({
    queryKey: ["charging-window", requestedHours],
    queryFn: ({ signal }) => getChargingWindow(requestedHours, signal),
    enabled: requestedHours > 0,
    staleTime: untilNextForecast
  });
  const isSubmitting = query.isFetching;
  const result = !isSubmitting && !query.isError ? query.data : undefined;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const hoursValue = Number(hours);

    if (
      !hours ||
      !Number.isInteger(hoursValue) ||
      hoursValue < 1 ||
      hoursValue > 6
    ) {
      setInvalid(true);
      setRequestedHours(0);
      return;
    }

    setInvalid(false);
    if (hoursValue === requestedHours && (query.isError || query.isStale)) {
      void query.refetch();
    }
    setRequestedHours(hoursValue);
  }

  return (
    <section className="card charging-card">
      <div className="section-heading">
        <h2>{t.chargingTitle}</h2>
        <p>{t.chargingDescription}</p>
      </div>

      <form className="charging-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>{t.chargingTime}</span>
          <span className="charging-input-row">
            <input
              type="number"
              min="1"
              max="6"
              step="1"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              aria-describedby="charging-hours-hint"
            />
            <span className="field-hint" id="charging-hours-hint">
              {t.chargingHint}
            </span>
          </span>
        </label>

        <button
          className="charging-submit"
          type="submit"
          disabled={isSubmitting}
          aria-label={isSubmitting ? t.chargingLoading : undefined}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span
                className="loading-spinner button-spinner"
                aria-hidden="true"
              />
              <span className="sr-only">{t.chargingLoading}</span>
            </>
          ) : (
            t.chargingSubmit
          )}
        </button>
      </form>

      {(invalid || query.isError) && (
        <p className="alert alert-error">
          {invalid ? t.chargingValidation : t.chargingError}
        </p>
      )}

      {result && (
        <>
          <div className="result">
            <div>
              <span>{t.resultStart}</span>
              <strong>
                {formatLondonDateTime(result.start, t.dateLocale, t.dateHour12)}
              </strong>
            </div>
            <div>
              <span>{t.resultEnd}</span>
              <strong>
                {formatLondonDateTime(result.end, t.dateLocale, t.dateHour12)}
              </strong>
            </div>
            <div>
              <span>{t.resultAverageCleanEnergy}</span>
              <strong>{result.averageCleanEnergyPercentage}%</strong>
            </div>
          </div>
          {onReserveWindow && (
            <button
              className="charging-reserve-window"
              type="button"
              onClick={() => onReserveWindow(result)}
            >
              {t.reserveChargingWindow}
            </button>
          )}
        </>
      )}
    </section>
  );
}
