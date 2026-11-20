import { useState } from "react";
import { getChargingWindow } from "../../api/energyApi";
import type { ChargingWindowResult } from "../../api/energyApi";
import type { Translations } from "../../i18n/i18n";
import { formatLondonDateTime } from "../../lib/londonDate";

interface Props {
  t: Translations;
  onReserveWindow?: (result: ChargingWindowResult) => void;
}

type ChargingError = "validation" | "request";

export function ChargingForm({ t, onReserveWindow }: Props) {
  const [hours, setHours] = useState("3");
  const [result, setResult] = useState<ChargingWindowResult | null>(null);
  const [error, setError] = useState<ChargingError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const hoursValue = Number(hours);

    if (
      !hours ||
      !Number.isInteger(hoursValue) ||
      hoursValue < 1 ||
      hoursValue > 6
    ) {
      setError("validation");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await getChargingWindow(hoursValue);
      setResult(data);
    } catch {
      setError("request");
    } finally {
      setIsSubmitting(false);
    }
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

      {error && (
        <p className="alert alert-error">
          {error === "validation" ? t.chargingValidation : t.chargingError}
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
