import { ChargingForm } from "../components/charging/ChargingForm";
import { EnergyMixSection } from "../components/energy/EnergyMixSection";
import { AppHeader } from "../components/layout/AppHeader";
import { ReservationsSection } from "../components/reservations/ReservationsSection";
import type { ReservationsHandle } from "../components/reservations/ReservationsSection";
import { useEnergyMix } from "../hooks/useEnergyMix";
import { useFuelSelection } from "../hooks/useFuelSelection";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";

export function EnergyMixPage() {
  const { energyMix, loading, error, retry } = useEnergyMix();
  const { language, t, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { selectedFuels, handleFuelSelect } = useFuelSelection();
  const reservations = useRef<ReservationsHandle>(null);

  return (
    <main>
      <AppHeader
        t={t}
        theme={theme}
        onLanguageToggle={toggleLanguage}
        onThemeToggle={toggleTheme}
      />

      <EnergyMixSection
        energyMix={energyMix}
        error={error}
        loading={loading}
        selectedFuels={selectedFuels}
        t={t}
        onFuelSelect={handleFuelSelect}
        onRetry={retry}
      />

      <ChargingForm
        t={t}
        onReserveWindow={(result) => reservations.current?.prefill(result)}
      />
      <ReservationsSection language={language} t={t} ref={reservations} />
    </main>
  );
}
import { useRef } from "react";
