import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getChargingWindow, getEnergyMix } from "./api/energyApi";
import {
  bookReservation,
  getChargers,
  getReservations,
  isReservationConfigError
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
  isReservationConfigError: vi.fn(),
  reservationErrorCode: vi.fn(),
  reservationErrorStatus: vi.fn(),
  bookReservation: vi.fn(async () => undefined),
  cancelReservation: vi.fn(async () => undefined)
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnergyMix).mockResolvedValue([]);
    vi.mocked(getChargers).mockResolvedValue([]);
    vi.mocked(isReservationConfigError).mockReturnValue(false);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the app header, energy section, and charging form together", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Energy Mix UK" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rezerwacje ładowarek" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /najlepsze okno/i
      })
    ).toBeInTheDocument();
  });

  it("keeps the charging form without the reserve action when reservations are not configured", async () => {
    const missingConfig = new Error("Missing database configuration");
    vi.mocked(getChargers).mockRejectedValueOnce(missingConfig);
    vi.mocked(isReservationConfigError).mockImplementation(
      (error) => error === missingConfig
    );
    vi.mocked(getChargingWindow).mockResolvedValueOnce({
      start: "2026-07-17T23:30:00Z",
      end: "2026-07-18T02:30:00Z",
      averageCleanEnergyPercentage: 65
    });
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("DATABASE_URL");
    fireEvent.click(screen.getByRole("button", { name: "Oblicz" }));
    expect(await screen.findByText(/65/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zarezerwuj ten termin" })
    ).not.toBeInTheDocument();
    expect(getReservations).not.toHaveBeenCalled();
  });

  it("keeps the charging form when the energy mix request fails", async () => {
    vi.mocked(getEnergyMix).mockRejectedValueOnce(new Error("Unavailable"));
    render(<App />);

    expect(
      await screen.findByText(
        "Nie udało się pobrać danych o miksie energetycznym."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oblicz" })).toBeInTheDocument();
  });

  it("shows own reservations when loading chargers fails", async () => {
    vi.mocked(getChargers).mockRejectedValueOnce(new Error("Timeout"));
    vi.mocked(getReservations).mockResolvedValueOnce([
      {
        id: "r1",
        chargerId: "london",
        startAt: "2099-01-01T10:00:00Z",
        endAt: "2099-01-01T12:00:00Z",
        cancelledAt: null
      }
    ]);
    render(<App />);

    expect(await screen.findByText("london")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anuluj rezerwację" })
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

    fireEvent.click(await screen.findByRole("button", { name: "Oblicz" }));
    const prefill = await screen.findByRole("button", {
      name: "Zarezerwuj ten termin"
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" }
    });
    fireEvent.click(prefill);

    expect(screen.getByLabelText("Start (czas londyński)")).toHaveValue(
      "2026-07-17T23:30:00.000Z"
    );
    expect(screen.getByLabelText("Czas rezerwacji")).toHaveValue("3");
    const summary = screen.getByRole("region", { name: "Twoja rezerwacja" });
    expect(summary).toHaveTextContent("3 h");
    expect(summary).not.toHaveTextContent(/czysta energia|65%/i);
    expect(screen.getByText("65%")).toBeInTheDocument();
    const charger = screen.getByLabelText("Ładowarka");
    expect(charger).toHaveFocus();
    expect(bookReservation).not.toHaveBeenCalled();

    fireEvent.change(charger, { target: { value: "edinburgh" } });
    const book = screen.getByRole("button", { name: "Zarezerwuj" });
    await waitFor(() => expect(book).toBeEnabled());
    fireEvent.click(book);
    await waitFor(() =>
      expect(bookReservation).toHaveBeenCalledWith({
        chargerId: "edinburgh",
        startAt: "2026-07-17T23:30:00.000Z",
        durationHours: 3
      })
    );
  });
});
