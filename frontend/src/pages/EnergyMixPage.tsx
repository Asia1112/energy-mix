import { useRef } from "react";
import { ChargingForm } from "../components/charging/ChargingForm";
import { EnergyMixSection } from "../components/energy/EnergyMixSection";
import { AppHeader } from "../components/layout/AppHeader";
import { ReservationsSection } from "../components/reservations/ReservationsSection";
import type { ReservationsHandle } from "../components/reservations/ReservationsSection";
import { useEnergyMix } from "../hooks/useEnergyMix";
import { useFuelSelection } from "../hooks/useFuelSelection";
import { useChargers } from "../hooks/useChargers";
import { useTheme } from "../hooks/useTheme";

export function EnergyMixPage() {
  const { energyMix, loading, error, retry } = useEnergyMix();
  const { theme, toggleTheme } = useTheme();
  const { selectedFuels, handleFuelSelect } = useFuelSelection();
  const reservations = useRef<ReservationsHandle>(null);
  const chargers = useChargers();

  return (
    <main>
      <AppHeader theme={theme} onThemeToggle={toggleTheme} />

      <EnergyMixSection
        energyMix={energyMix}
        error={error}
        loading={loading}
        selectedFuels={selectedFuels}
        onFuelSelect={handleFuelSelect}
        onRetry={retry}
      />

      <ChargingForm
        onReserveWindow={
          chargers.isSuccess
            ? (result) => reservations.current?.prefill(result)
            : undefined
        }
      />
      <ReservationsSection chargers={chargers} ref={reservations} />
    </main>
  );
}
