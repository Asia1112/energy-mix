import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  bookReservation,
  cancelReservation,
  getBookings,
  getChargers,
  getReservations,
  reservationErrorStatus
} from "../../api/reservationApi";
import type { Reservation } from "../../api/reservationApi";
import { translations } from "../../i18n/i18n";
import { ReservationsSection } from "./ReservationsSection";

vi.mock("../../api/reservationApi", () => ({
  bookReservation: vi.fn(),
  cancelReservation: vi.fn(),
  getBookings: vi.fn(),
  getChargers: vi.fn(),
  getReservations: vi.fn(),
  reservationErrorStatus: vi.fn()
}));

const charger = { id: "london", name: "King’s Cross", location: "London" };
const booking = {
  id: "reservation-1",
  chargerId: charger.id,
  startAt: "2026-07-16T10:00:00.000Z",
  endAt: "2026-07-16T11:00:00.000Z",
  cancelledAt: null
};

describe("ReservationsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-16T09:01:00Z"));
    vi.mocked(getChargers).mockResolvedValue([charger]);
    vi.mocked(getBookings).mockResolvedValue([]);
    vi.mocked(getReservations).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function chooseTimeAndBook() {
    const time = await screen.findByLabelText("Start (London time)");
    fireEvent.change(time, { target: { value: booking.startAt } });
    const submit = screen.getByRole("button", { name: "Book charger" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
  }

  it("books a London time and refreshes the calendar and own list after booking and cancelling", async () => {
    let reservations: Reservation[] = [];
    vi.mocked(getReservations).mockImplementation(async () => reservations);
    vi.mocked(getBookings).mockImplementation(async () =>
      reservations.filter((item) => !item.cancelledAt)
    );
    vi.mocked(bookReservation).mockImplementation(async () => {
      reservations = [booking];
    });
    vi.mocked(cancelReservation).mockImplementation(async () => {
      reservations = [{ ...booking, cancelledAt: "2026-07-16T09:05:00.000Z" }];
    });

    render(<ReservationsSection language="en" t={translations.en} />);
    await chooseTimeAndBook();
    expect(bookReservation).toHaveBeenCalledWith({
      chargerId: charger.id,
      durationHours: 1,
      startAt: booking.startAt
    });
    expect(await screen.findByText("Charger booked.")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "16/07/2026, Booked: 1" })
    ).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel reservation" })
    );

    expect(cancelReservation).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(
      await screen.findByText("No bookings on this day.")
    ).toBeInTheDocument();
  });

  it("reports a booking conflict and reloads availability", async () => {
    vi.mocked(bookReservation).mockRejectedValue(new Error("conflict"));
    vi.mocked(reservationErrorStatus).mockReturnValue(409);

    render(<ReservationsSection language="en" t={translations.en} />);
    await chooseTimeAndBook();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This charger is booked at the selected time."
    );
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText("You have no reservations yet.")
    ).toBeInTheDocument();
  });

  it("shows the full month, navigates between months and selects a booked date", async () => {
    vi.mocked(getBookings).mockImplementation(async (_charger, from) =>
      from === "2026-07-31T23:00:00.000Z"
        ? [
            {
              startAt: "2026-08-31T10:00:00.000Z",
              endAt: "2026-08-31T11:00:00.000Z"
            }
          ]
        : []
    );
    render(<ReservationsSection language="en" t={translations.en} />);

    const month = await screen.findByRole("button", { name: "Month" });
    fireEvent.click(month);
    expect(month).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /\/07\/2026(?:,|$)/ })
    ).toHaveLength(31);

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    const pastDate = screen.getByRole("button", {
      name: "15/06/2026, past date"
    });
    expect(pastDate).toHaveAttribute("data-past");
    fireEvent.click(pastDate);
    expect(
      await screen.findByText("This date can no longer be booked.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reservation date")).toHaveValue("16/07/2026");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    const busyDay = await screen.findByRole("button", {
      name: "31/08/2026, Booked: 1"
    });
    expect(busyDay).not.toHaveAttribute("data-past");
    expect(getBookings).toHaveBeenCalledWith(
      charger.id,
      "2026-07-31T23:00:00.000Z",
      "2026-08-31T23:00:00.000Z",
      expect.any(AbortSignal)
    );
    fireEvent.click(busyDay);
    expect(screen.getByLabelText("Reservation date")).toHaveValue("31/08/2026");
    expect(screen.getByText(/Booked · .*11:00\s*am BST/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(
      screen.getByRole("button", { name: "Next week" })
    ).toBeInTheDocument();
  });

  it("accepts a day-first date and rejects invalid or past dates", async () => {
    render(<ReservationsSection language="en" t={translations.en} />);
    const date = await screen.findByLabelText("Reservation date");

    for (const invalid of ["31/02/2027", "15/07/2026"]) {
      fireEvent.change(date, { target: { value: invalid } });
      fireEvent.blur(date);
      expect(date).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid date");
    }

    fireEvent.change(date, { target: { value: "20082026" } });
    fireEvent.keyDown(date, { key: "Enter" });
    expect(date).toHaveValue("20/08/2026");
    expect(date).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "20/08/2026" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(bookReservation).not.toHaveBeenCalled();
  });
});
