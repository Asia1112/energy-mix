import type { Pool } from "pg";

interface Charger {
  id: string;
  name: string;
  location: string;
}

interface Booking {
  startAt: Date;
  endAt: Date;
}

interface Reservation extends Booking {
  id: string;
  chargerId: string;
  cancelledAt: Date | null;
}

const reservationFields = `
  id, charger_id AS "chargerId", start_at AS "startAt",
  end_at AS "endAt", cancelled_at AS "cancelledAt"
`;

export async function listChargers(pool: Pool): Promise<Charger[]> {
  const { rows } = await pool.query<Charger>(
    "SELECT id, name, location FROM chargers ORDER BY location, name, id"
  );
  return rows;
}

export async function listBookings(
  pool: Pool,
  chargerId: string,
  from: Date,
  to: Date
): Promise<Booking[] | null> {
  const charger = await pool.query("SELECT 1 FROM chargers WHERE id = $1", [
    chargerId
  ]);
  if (charger.rowCount === 0) {
    return null;
  }

  const { rows } = await pool.query<Booking>(
    `SELECT start_at AS "startAt", end_at AS "endAt"
     FROM reservations
     WHERE charger_id = $1 AND cancelled_at IS NULL
       AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
     ORDER BY start_at`,
    [chargerId, from, to]
  );
  return rows;
}

export async function createReservation(
  pool: Pool,
  ownerId: string,
  chargerId: string,
  startAt: Date,
  endAt: Date
): Promise<Reservation> {
  const { rows } = await pool.query<Reservation>(
    `INSERT INTO reservations (owner_id, charger_id, start_at, end_at)
     VALUES ($1, $2, $3, $4)
     RETURNING ${reservationFields}`,
    [ownerId, chargerId, startAt, endAt]
  );
  return rows[0];
}

export async function listReservations(
  pool: Pool,
  ownerId: string
): Promise<Reservation[]> {
  const { rows } = await pool.query<Reservation>(
    `SELECT ${reservationFields}
     FROM reservations
     WHERE owner_id = $1
     ORDER BY start_at, id`,
    [ownerId]
  );
  return rows;
}

export async function cancelReservation(
  pool: Pool,
  ownerId: string,
  reservationId: string
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE reservations
     SET cancelled_at = COALESCE(cancelled_at, clock_timestamp())
     WHERE id = $1 AND owner_id = $2`,
    [reservationId, ownerId]
  );
  return result.rowCount === 1;
}
