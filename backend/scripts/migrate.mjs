import process from "node:process";
import dotenv from "dotenv";
import { runner } from "node-pg-migrate";

dotenv.config({ path: [".env", ".env.local"], quiet: true });

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Set DATABASE_URL_UNPOOLED or DATABASE_URL to run migrations."
  );
}

await runner({
  databaseUrl,
  direction: "up",
  dir: "migrations",
  migrationsTable: "pgmigrations",
  singleTransaction: true
});
