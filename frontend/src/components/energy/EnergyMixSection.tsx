import type { DailyEnergyMix } from "../../api/energyApi";
import { useLanguage } from "../../hooks/useLanguage";
import { LoadingState } from "../layout/LoadingState";
import { EnergyLegend } from "./EnergyLegend";
import { EnergyPieChart } from "./EnergyPieChart";

interface Props {
  energyMix: DailyEnergyMix[];
  error: boolean;
  loading: boolean;
  selectedFuels: string[];
  onFuelSelect: (fuel: string) => void;
  onRetry: () => void;
}

function getFuels(energyMix: DailyEnergyMix[]): string[] {
  return Array.from(new Set(energyMix.flatMap((day) => Object.keys(day.mix))));
}

export function EnergyMixSection({
  energyMix,
  error,
  loading,
  selectedFuels,
  onFuelSelect,
  onRetry
}: Props) {
  const { t } = useLanguage();
  const fuels = getFuels(energyMix);
  const highestCleanEnergy = Math.max(
    ...energyMix.map((day) => day.cleanEnergyPercentage)
  );

  return (
    <>
      <p className="app-description">{t.appDescription}</p>

      <section className="energy-mix-panel">
        {error && (
          <div className="alert alert-error retry-alert">
            <p>{t.energyMixError}</p>
            <button type="button" onClick={onRetry}>
              {t.retry}
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState label={t.loading} />
        ) : (
          <>
            <EnergyLegend
              fuels={fuels}
              selectedFuels={selectedFuels}
              onFuelSelect={onFuelSelect}
              ariaLabel={t.legendLabel}
            />

            {energyMix.length > 0 ? (
              <section className="grid">
                {energyMix.map((day) => (
                  <EnergyPieChart
                    key={day.date}
                    day={day}
                    selectedFuels={selectedFuels}
                    onFuelSelect={onFuelSelect}
                    cleanEnergyLabel={t.cleanEnergy}
                    cleanestDayLabel={
                      day.cleanEnergyPercentage === highestCleanEnergy
                        ? t.cleanestDay
                        : undefined
                    }
                    dateLocale={t.dateLocale}
                  />
                ))}
              </section>
            ) : (
              <p className="empty-state">{t.emptyState}</p>
            )}
          </>
        )}
      </section>
    </>
  );
}
