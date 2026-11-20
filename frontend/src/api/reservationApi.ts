import axios from "axios";

export interface Charger {
  id: string;
  name: string;
  location: string;
}

export interface Booking {
  startAt: string;
  endAt: string;
}

export interface Reservation extends Booking {
  id: string;
  chargerId: string;
  cancelledAt: string | null;
}

interface ReservationInput {
  chargerId: string;
  startAt: string;
  durationHours: number;
}

const api = axios.create({ baseURL: "/api", timeout: 10000 });
let pendingSession: Promise<void> | undefined;

export function reservationErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function startSession(): Promise<void> {
  pendingSession ??= api
    .post("/reservation-session")
    .then(({ status }) => {
      if (status !== 204)
        throw new Error("Invalid reservation session response");
    })
    .finally(() => {
      pendingSession = undefined;
    });

  return pendingSession;
}

async function getList<T>(
  path: string,
  signal: AbortSignal,
  params?: Record<string, string>
): Promise<T[]> {
  const { data } = await api.get<T[]>(path, { signal, params });
  if (!Array.isArray(data))
    throw new Error("Invalid reservation list response");
  return data;
}

export function getChargers(signal: AbortSignal): Promise<Charger[]> {
  return getList("/chargers", signal);
}

export function getBookings(
  chargerId: string,
  from: string,
  to: string,
  signal: AbortSignal
): Promise<Booking[]> {
  return getList(
    `/chargers/${encodeURIComponent(chargerId)}/bookings`,
    signal,
    {
      from,
      to
    }
  );
}

export async function getReservations(
  signal: AbortSignal
): Promise<Reservation[]> {
  try {
    return await getList("/reservations", signal);
  } catch (error) {
    if (signal.aborted || reservationErrorStatus(error) !== 401) throw error;

    await startSession();
    return getList("/reservations", signal);
  }
}

export async function bookReservation(input: ReservationInput): Promise<void> {
  const { status } = await api.post("/reservations", input);
  if (status !== 201) throw new Error("Invalid create reservation response");
}

export async function cancelReservation(id: string): Promise<void> {
  const { status } = await api.delete(
    `/reservations/${encodeURIComponent(id)}`
  );
  if (status !== 204) throw new Error("Invalid cancel reservation response");
}
