import dotenv from "dotenv";
import { Pool } from "pg";
import { createApp } from "./app";

dotenv.config({ path: [".env", ".env.local"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.RESERVATION_SESSION_SECRET;

if (
  (databaseUrl || sessionSecret) &&
  (!databaseUrl || !sessionSecret || sessionSecret.length < 32)
) {
  throw new Error(
    "Set DATABASE_URL and a RESERVATION_SESSION_SECRET of at least 32 characters."
  );
}

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : undefined;
pool?.on("error", (error) => console.error("PostgreSQL pool error", error));

const app = createApp(
  pool && sessionSecret
    ? {
        pool,
        sessionSecret,
        secureCookies: process.env.NODE_ENV === "production"
      }
    : undefined
);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
