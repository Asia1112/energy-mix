import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Pool } from "pg";
import energyRoutes from "./routes/energy.routes";

import {
  createReservationRouter,
  type ReservationOptions
} from "./routes/reservation.routes";

const API_RATE_LIMIT = 120;
const API_RATE_WINDOW_MS = 60_000;
const DATABASE_HEALTH_QUERY = { text: "SELECT 1", query_timeout: 2_000 };

export function createApp(
  reservations?: ReservationOptions,
  database: Pool | undefined = reservations?.pool
) {
  const app = express();
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (Number.isSafeInteger(proxyHops) && proxyHops > 0) {
    app.set("trust proxy", proxyHops);
  }
  const corsOriginConfig = process.env.CORS_ORIGIN || "*";
  const corsOrigins = corsOriginConfig
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigin = corsOrigins.includes("*") ? "*" : corsOrigins;

  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET"],
      allowedHeaders: ["Content-Type"],
      maxAge: 86400
    })
  );
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/db", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!database) {
      return res
        .status(503)
        .json({ status: "unavailable", database: "not_configured" });
    }

    try {
      await database.query(DATABASE_HEALTH_QUERY);
      res.json({ status: "ok", database: "up" });
    } catch {
      res.status(503).json({ status: "unavailable", database: "down" });
    }
  });

  app.use(
    "/api",
    rateLimit({
      windowMs: API_RATE_WINDOW_MS,
      limit: API_RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Try again later." }
    }),
    express.json()
  );
  app.use("/api", energyRoutes);
  if (reservations) {
    app.use("/api", createReservationRouter(reservations));
  } else {
    app.use(
      ["/api/chargers", "/api/reservation-session", "/api/reservations"],
      (req, res) => {
        res.set("Cache-Control", "no-store").status(503).json({
          code: "RESERVATIONS_NOT_CONFIGURED",
          message:
            "Set DATABASE_URL and RESERVATION_SESSION_SECRET to enable reservations."
        });
      }
    );
  }

  app.get("/", (req, res) => {
    res.send("Energy Mix API is running.");
  });

  return app;
}
