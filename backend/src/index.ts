import dotenv from "dotenv";
import { Pool } from "pg";
import { createApp } from "./app";

dotenv.config({ path: [".env", ".env.local"], quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
const sessionSecret = process.env.RESERVATION_SESSION_SECRET;
const validConfig = Boolean(
  databaseUrl && sessionSecret && sessionSecret.trim().length >= 32
);

// A partial config is a deploy mistake: fail loudly instead of disabling reservations.
if ((databaseUrl || sessionSecret?.trim()) && !validConfig) {
  throw new Error(
    "Set DATABASE_URL and a RESERVATION_SESSION_SECRET of at least 32 characters."
  );
}

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 })
  : undefined;
pool?.on("error", (error) => console.error("PostgreSQL pool error", error));

const reservations =
  pool && sessionSecret && validConfig
    ? {
        pool,
        sessionSecret,
        secureCookies: process.env.NODE_ENV === "production"
      }
    : undefined;

if (!reservations) {
  console.warn(
    "Reservations disabled. Set DATABASE_URL and a RESERVATION_SESSION_SECRET of at least 32 characters."
  );
}

const app = createApp(reservations, pool);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
