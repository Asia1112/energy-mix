import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getChargingWindow } from "./api/energyApi";
import {
  bookReservation,
  getChargers,
  getReservations
} from "./api/reservationApi";
import App from "./App";

vi.mock("./api/energyApi", () => ({
  getEnergyMix: vi.fn(() => new Promise(() => undefined)),
  getChargingWindow: vi.fn()
}));

vi.mock("./api/reservationApi", () => ({
  getChargers: vi.fn(() => new Promise(() => undefined)),
  getReservations: vi.fn(() => new Promise(() => undefined)),
  getBookings: vi.fn(async () => []),
  bookReservation: vi.fn(async () => undefined)
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the app header, energy section, and charging form together", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Energy Mix UK" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rezerwacje ładowarek" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /najlepsze okno/i
      })
    ).toBeInTheDocument();
  });

  it("fills the reservation from the recommendation and books only on confirmation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-17T12:00:00Z"));
    vi.mocked(getChargingWindow).mockResolvedValueOnce({
      start: "2026-07-17T23:30:00Z",
      end: "2026-07-18T02:30:00Z",
      averageCleanEnergyPercentage: 65
    });
    vi.mocked(getChargers).mockResolvedValueOnce([
      { id: "london", name: "King’s Cross", location: "London" },
      { id: "edinburgh", name: "Waverley", location: "Edinburgh" }
    ]);
    vi.mocked(getReservations).mockResolvedValue([]);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Oblicz" }));
    const prefill = await screen.findByRole("button", {
      name: "Zarezerwuj ten termin"
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" }
    });
    fireEvent.click(prefill);

    expect(screen.getByLabelText("Data rezerwacji")).toHaveValue("18.07.2026");
    expect(screen.getByLabelText("Start (czas londyński)")).toHaveValue(
      "2026-07-17T23:30:00.000Z"
    );
    expect(screen.getByLabelText("Czas rezerwacji")).toHaveValue("3");
    const charger = screen.getByLabelText("Ładowarka");
    expect(charger).toHaveFocus();
    expect(bookReservation).not.toHaveBeenCalled();

    fireEvent.change(charger, { target: { value: "edinburgh" } });
    fireEvent.click(screen.getByRole("button", { name: "Zarezerwuj" }));
    await waitFor(() =>
      expect(bookReservation).toHaveBeenCalledWith({
        chargerId: "edinburgh",
        startAt: "2026-07-17T23:30:00.000Z",
        durationHours: 3
      })
    );
  });
});
