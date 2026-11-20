import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  bookReservation,
  cancelReservation,
  getBookings,
  getChargers,
  getReservations,
  isReservationConfigError,
  reservationErrorCode,
  reservationErrorStatus
} from "../../api/reservationApi";
import type { Reservation } from "../../api/reservationApi";
import { useChargers } from "../../hooks/useChargers";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ReservationsSection } from "./ReservationsSection";

vi.mock("../../api/reservationApi", () => ({
  bookReservation: vi.fn(),
  cancelReservation: vi.fn(),
  getBookings: vi.fn(),
  getChargers: vi.fn(),
  getReservations: vi.fn(),
  isReservationConfigError: vi.fn(),
  reservationErrorCode: vi.fn(),
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

function TestReservationsSection() {
  const chargers = useChargers();
  return <ReservationsSection chargers={chargers} />;
}

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

    renderWithProviders(<TestReservationsSection />, "en");
    await chooseTimeAndBook();
    await waitFor(() =>
      expect(bookReservation).toHaveBeenCalledWith({
        chargerId: charger.id,
        durationHours: 1,
        startAt: booking.startAt
      })
    );
    expect(await screen.findByText("Charger booked.")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "16/07/2026, Booked: 1" })
    ).toHaveAccessibleDescription("4% booked");

    const cancel = await screen.findByRole("button", {
      name: "Cancel reservation"
    });
    await waitFor(() => expect(cancel).toBeEnabled());
    fireEvent.click(cancel);

    await waitFor(() =>
      expect(cancelReservation).toHaveBeenCalledWith(booking.id)
    );
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(
      await screen.findByText("No bookings on this day.")
    ).toBeInTheDocument();
  });

  it("explains missing backend configuration without starting a guest session", async () => {
    vi.mocked(getChargers).mockRejectedValue(
      new Error("Missing configuration")
    );
    vi.mocked(isReservationConfigError).mockReturnValue(true);
    renderWithProviders(<TestReservationsSection />, "en");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check DATABASE_URL and RESERVATION_SESSION_SECRET on the backend."
    );
    expect(
      screen.queryByRole("heading", { name: "My reservations" })
    ).not.toBeInTheDocument();
    expect(getReservations).not.toHaveBeenCalled();
  });

  it.each([
    ["In progress", "2026-07-16T09:01:00.000Z", "2026-07-16T10:01:00.000Z"],
    ["Completed", "2026-07-16T08:00:00.000Z", "2026-07-16T09:00:00.000Z"]
  ])(
    "shows %s reservations without a cancel action",
    async (status, startAt, endAt) => {
      vi.mocked(getReservations).mockResolvedValue([
        {
          ...booking,
          startAt,
          endAt
        }
      ]);
      renderWithProviders(<TestReservationsSection />, "en");

      expect(await screen.findByText(status)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Cancel reservation" })
      ).not.toBeInTheDocument();
    }
  );

  it("reports a booking conflict and reloads availability", async () => {
    vi.mocked(bookReservation).mockRejectedValue(new Error("conflict"));
    vi.mocked(reservationErrorStatus).mockReturnValue(409);

    renderWithProviders(<TestReservationsSection />, "en");
    await chooseTimeAndBook();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This charger is booked at the selected time."
    );
    // Initial week load plus one reload after the conflict; no per-slot requests.
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText("You have no reservations yet.")
    ).toBeInTheDocument();
  });

  it("lists start times without the time zone", async () => {
    renderWithProviders(<TestReservationsSection />, "en");

    await screen.findByLabelText("Start (London time)");
    expect(
      screen.getByRole("option", { name: /^11:00\s*am$/i })
    ).toBeInTheDocument();
  });

  it("adds the time zone only to times repeated when the clocks go back", async () => {
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    renderWithProviders(<TestReservationsSection />, "en");

    fireEvent.click(
      await screen.findByRole("button", { name: /^25\/10\/2026/ })
    );
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(
      options.filter((label) => /^01:30\s*am\s+\S+/i.test(label))
    ).toHaveLength(2);
    expect(options).toContainEqual(expect.stringMatching(/^02:00\s*am$/i));
  });

  it("explains why booking is blocked when own reservations fail to load", async () => {
    vi.mocked(getReservations)
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValue([]);
    renderWithProviders(<TestReservationsSection />, "en");

    const summary = await screen.findByRole("region", {
      name: "Your reservation"
    });
    const alert = await within(summary).findByRole("alert");
    expect(alert).toHaveTextContent(
      "Booking is unavailable because your reservations could not be loaded."
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(within(summary).queryByRole("alert")).not.toBeInTheDocument()
    );
  });

  it("blocks a session that would end after the last bookable day", async () => {
    renderWithProviders(<TestReservationsSection />, "en");

    fireEvent.click(await screen.findByRole("button", { name: "Next week" }));
    for (let week = 0; week < 4; week++) {
      fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    }
    fireEvent.click(screen.getByRole("button", { name: /^16\/08\/2026/ }));
    fireEvent.change(screen.getByLabelText("Start (London time)"), {
      target: { value: "2026-08-16T22:00:00.000Z" }
    });
    fireEvent.change(screen.getByLabelText("Reservation duration"), {
      target: { value: "3" }
    });
    const submit = screen.getByRole("button", { name: "Book charger" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A charger can be booked up to one month ahead."
    );
    expect(bookReservation).not.toHaveBeenCalled();
  });

  it("shows the one-month limit when the backend rejects a booking as too far ahead", async () => {
    vi.mocked(bookReservation).mockRejectedValue(new Error("too far"));
    vi.mocked(reservationErrorStatus).mockReturnValue(400);
    vi.mocked(reservationErrorCode).mockReturnValue("TOO_FAR_AHEAD");

    renderWithProviders(<TestReservationsSection />, "en");
    await chooseTimeAndBook();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A charger can be booked up to one month ahead."
    );
  });

  it("shows the selected interval in the summary and blocks an occupied slot", async () => {
    vi.mocked(getBookings).mockResolvedValue([booking]);
    renderWithProviders(<TestReservationsSection />, "en");
    const time = await screen.findByLabelText("Start (London time)");
    fireEvent.change(time, { target: { value: booking.startAt } });

    expect(
      await screen.findByText("This time is already booked.")
    ).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Your reservation" });
    expect(summary).toHaveTextContent("King’s Cross · London");
    expect(summary).toHaveTextContent("11:00 am–12:00 pm");
    expect(screen.getByRole("button", { name: "Book charger" })).toBeDisabled();
    expect(getBookings).not.toHaveBeenCalledWith(
      charger.id,
      booking.startAt,
      booking.endAt,
      expect.any(AbortSignal)
    );
    expect(bookReservation).not.toHaveBeenCalled();
  });

  it("navigates between weeks and allows booking only one month ahead", async () => {
    vi.mocked(getBookings).mockImplementation(async (_charger, from) =>
      from === "2026-08-09T23:00:00.000Z"
        ? [
            {
              startAt: "2026-08-14T10:00:00.000Z",
              endAt: "2026-08-14T11:00:00.000Z"
            }
          ]
        : []
    );
    renderWithProviders(<TestReservationsSection />, "en");

    const next = await screen.findByRole("button", { name: "Next week" });
    expect(
      screen.queryByRole("button", { name: "Month" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    const pastDate = screen.getByRole("button", {
      name: "09/07/2026, past date"
    });
    expect(pastDate).toHaveAttribute("data-past");
    fireEvent.click(pastDate);
    expect(
      await screen.findByText("This date can no longer be booked.")
    ).toBeInTheDocument();

    for (let week = 0; week < 5; week++) fireEvent.click(next);
    expect(next).toBeDisabled();
    expect(screen.getByRole("button", { name: "16/08/2026" })).toBeEnabled();
    const busyDay = await screen.findByRole("button", {
      name: "14/08/2026, Booked: 1"
    });
    expect(busyDay).not.toHaveAttribute("data-past");
    fireEvent.click(busyDay);
    const booked = screen.getByText(/Booked · .*11:00\s*am/i);
    expect(booked).not.toHaveTextContent(/BST|GMT/);
  });
});
