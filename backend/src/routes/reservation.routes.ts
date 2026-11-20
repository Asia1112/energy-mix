import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { DatabaseError, type Pool } from "pg";
import { MAX_CHARGING_HOURS, MIN_CHARGING_HOURS } from "../config/charging";
import {
  cancelReservation,
  createReservation,
  listBookings,
  listChargers,
  listReservations
} from "../db/reservations";

const COOKIE_NAME = "reservation_session";
const HOUR_MS = 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 365 * 24 * HOUR_MS;
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN =
  /^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export interface ReservationOptions {
  pool: Pool;
  sessionSecret: string;
  secureCookies?: boolean;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const parts = TIMESTAMP_PATTERN.exec(value);
  if (!parts) {
    return null;
  }

  const [, year, month, day] = parts;
  const daysInMonth = new Date(
    Date.UTC(Number(year), Number(month), 0)
  ).getUTCDate();
  const timestamp = new Date(value);
  return Number(day) <= daysInMonth && Number.isFinite(timestamp.getTime())
    ? timestamp
    : null;
}

const requireSameOriginWrite: RequestHandler = (req, res, next) => {
  const site = req.get("Sec-Fetch-Site");
  if (site && site !== "same-origin" && site !== "none") {
    res.status(403).json({ message: "Cross-origin reservation request." });
    return;
  }

  next();
};

const sendReservationError: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof DatabaseError) {
    switch (error.constraint) {
      case "reservations_no_overlap":
        res.status(409).json({ message: "This charger is already booked." });
        return;
      case "reservations_charger_fk":
        res.status(404).json({ message: "Charger not found." });
        return;
      case "reservations_future_start":
        res.status(400).json({ message: "The start must be in the future." });
        return;
    }
  }

  console.error("Reservation request failed", { method: req.method, error });
  res.status(500).json({ message: "Reservation request failed." });
};

export function createReservationRouter({
  pool,
  sessionSecret,
  secureCookies = false
}: ReservationOptions) {
  const router = Router();
  const parseSessionCookie = cookieParser(sessionSecret);

  router.get("/chargers", async (req, res) => {
    res.json(await listChargers(pool));
  });

  router.get("/chargers/:id/bookings", async (req, res) => {
    const from = parseTimestamp(req.query.from);
    const to = parseTimestamp(req.query.to);
    if (!from || !to || from >= to) {
      return res
        .status(400)
        .json({ message: "Provide a valid from/to range." });
    }

    const bookings = await listBookings(pool, req.params.id, from, to);
    if (bookings === null) {
      return res.status(404).json({ message: "Charger not found." });
    }
    res.json(bookings);
  });

  router.post(
    "/reservation-session",
    requireSameOriginWrite,
    parseSessionCookie,
    (req, res) => {
      const ownerId: unknown = req.signedCookies[COOKIE_NAME];
      const session = typeof ownerId === "string" ? ownerId : randomUUID();
      res.set("Cache-Control", "no-store");
      res.cookie(COOKIE_NAME, session, {
        signed: true,
        httpOnly: true,
        secure: secureCookies,
        sameSite: "strict",
        path: "/api",
        maxAge: SESSION_MAX_AGE_MS
      });
      res.sendStatus(204);
    }
  );

  router.use("/reservations", parseSessionCookie, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const ownerId: unknown = req.signedCookies[COOKIE_NAME];
    if (typeof ownerId !== "string") {
      res.status(401).json({ message: "Start a reservation session first." });
      return;
    }

    res.locals.ownerId = ownerId;
    next();
  });

  router.get("/reservations", async (req, res) => {
    res.json(await listReservations(pool, res.locals.ownerId));
  });

  router.post("/reservations", requireSameOriginWrite, async (req, res) => {
    const { chargerId, startAt, durationHours } = req.body ?? {};
    const start = parseTimestamp(startAt);

    if (typeof chargerId !== "string" || !chargerId.trim()) {
      return res.status(400).json({ message: "Provide a charger ID." });
    }
    if (!start || start.getTime() <= Date.now()) {
      return res.status(400).json({ message: "Provide a valid future start." });
    }
    if (
      typeof durationHours !== "number" ||
      !Number.isInteger(durationHours) ||
      durationHours < MIN_CHARGING_HOURS ||
      durationHours > MAX_CHARGING_HOURS
    ) {
      return res.status(400).json({
        message: `Duration must be a whole number from ${MIN_CHARGING_HOURS} to ${MAX_CHARGING_HOURS} hours.`
      });
    }

    const end = new Date(start.getTime() + durationHours * HOUR_MS);
    const reservation = await createReservation(
      pool,
      res.locals.ownerId,
      chargerId,
      start,
      end
    );
    res.status(201).json(reservation);
  });

  router.delete(
    "/reservations/:id",
    requireSameOriginWrite,
    async (req, res) => {
      const id = req.params.id;
      if (
        typeof id !== "string" ||
        !UUID_PATTERN.test(id) ||
        !(await cancelReservation(pool, res.locals.ownerId, id))
      ) {
        return res.status(404).json({ message: "Reservation not found." });
      }
      res.sendStatus(204);
    }
  );

  router.use(sendReservationError);

  return router;
}
