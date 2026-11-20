import { fireEvent, screen } from "@testing-library/react";
import { translations } from "../../i18n/i18n";
import { renderWithProviders } from "../../test/renderWithProviders";
import { EnergyMixSection } from "./EnergyMixSection";

vi.mock("./EnergyPieChart", () => ({
  EnergyPieChart: ({
    day,
    cleanestDayLabel
  }: {
    day: { date: string };
    cleanestDayLabel?: string;
  }) => (
    <article data-testid="energy-chart">
      {day.date}
      {cleanestDayLabel && <span>{cleanestDayLabel}</span>}
    </article>
  )
}));

describe("EnergyMixSection", () => {
  it("shows error alert and wires retry button", () => {
    const onRetry = vi.fn();

    renderWithProviders(
      <EnergyMixSection
        energyMix={[]}
        error={true}
        loading={false}
        selectedFuels={[]}
        onFuelSelect={vi.fn()}
        onRetry={onRetry}
      />,
      "en"
    );

    expect(
      screen.getByText(translations.en.energyMixError)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: translations.en.retry })
    );

    expect(onRetry).toHaveBeenCalled();
  });

  it("shows loading state while data is loading", () => {
    renderWithProviders(
      <EnergyMixSection
        energyMix={[]}
        error={false}
        loading={true}
        selectedFuels={[]}
        onFuelSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
      "en"
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      translations.en.loading
    );
  });

  it("shows empty state when there is no data", () => {
    renderWithProviders(
      <EnergyMixSection
        energyMix={[]}
        error={false}
        loading={false}
        selectedFuels={[]}
        onFuelSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
      "en"
    );

    expect(screen.getByText(translations.en.emptyState)).toBeInTheDocument();
  });

  it("renders one chart per day and deduplicates fuels across days", () => {
    renderWithProviders(
      <EnergyMixSection
        energyMix={[
          {
            date: "2026-07-03",
            mix: { wind: 40, gas: 60 },
            cleanEnergyPercentage: 40
          },
          {
            date: "2026-07-04",
            mix: { wind: 20, solar: 30, gas: 50 },
            cleanEnergyPercentage: 50
          }
        ]}
        error={false}
        loading={false}
        selectedFuels={["solar"]}
        onFuelSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
      "en"
    );

    expect(screen.getAllByTestId("energy-chart")).toHaveLength(2);
    expect(
      screen.getByText(translations.en.cleanestDay).closest("article")
    ).toHaveTextContent("2026-07-04");
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "wind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "gas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "solar" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("highlights all days tied for the highest clean energy share", () => {
    renderWithProviders(
      <EnergyMixSection
        energyMix={[
          { date: "2026-07-03", mix: { wind: 60 }, cleanEnergyPercentage: 60 },
          { date: "2026-07-04", mix: { wind: 50 }, cleanEnergyPercentage: 50 },
          { date: "2026-07-05", mix: { wind: 60 }, cleanEnergyPercentage: 60 }
        ]}
        error={false}
        loading={false}
        selectedFuels={[]}
        onFuelSelect={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const label = translations.pl.cleanestDay;
    const [first, second, third] = screen.getAllByTestId("energy-chart");
    expect(first).toHaveTextContent(label);
    expect(second).not.toHaveTextContent(label);
    expect(third).toHaveTextContent(label);
  });
});
