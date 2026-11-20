import { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app";

describe("app", () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin;
  });

  it("returns health check status", async () => {
    await request(createApp())
      .get("/health")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({ status: "ok" });
  });

  it("reports a missing database without failing process health", async () => {
    const app = createApp();
    await request(app)
      .get("/health/db")
      .expect(503)
      .expect("Cache-Control", "no-store")
      .expect({ status: "unavailable", database: "not_configured" });
    await request(app).get("/health").expect(200);
  });

  it("reports failed database queries without exposing database details", async () => {
    const database = new Pool();
    const query = jest.spyOn(database, "query").mockImplementationOnce(() => {
      throw new Error("Database connection details");
    });
    try {
      await request(createApp(undefined, database))
        .get("/health/db")
        .expect(503)
        .expect({ status: "unavailable", database: "down" });
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ text: "SELECT 1" })
      );
    } finally {
      await database.end();
    }
  });

  it("limits API requests by IP and leaves health checks available", async () => {
    const app = createApp();
    for (let attempt = 0; attempt < 120; attempt++) {
      await request(app).get("/api/chargers").expect(503);
    }
    await request(app)
      .get("/api/chargers")
      .expect(429)
      .expect("Retry-After", /^\d+$/)
      .expect({ message: "Too many requests. Try again later." });
    await request(app).get("/health").expect(200);
    await request(app).get("/health/db").expect(503);
  });

  it("reports missing reservation configuration for both public and private reservation routes", async () => {
    const app = createApp();
    for (const response of [
      request(app).get("/api/chargers"),
      request(app).get("/api/chargers/london/bookings"),
      request(app).post("/api/reservation-session"),
      request(app).get("/api/reservations"),
      request(app).post("/api/reservations"),
      request(app).delete("/api/reservations/reservation-id")
    ]) {
      await response.expect(503).expect("Cache-Control", "no-store").expect({
        code: "RESERVATIONS_NOT_CONFIGURED",
        message:
          "Set DATABASE_URL and RESERVATION_SESSION_SECRET to enable reservations."
      });
    }
  });

  it("returns the root API message", async () => {
    await request(createApp())
      .get("/")
      .expect(200)
      .expect("Energy Mix API is running.");
  });

  it("allows any CORS origin when CORS_ORIGIN includes wildcard", async () => {
    process.env.CORS_ORIGIN = "http://localhost:5173,*";

    await request(createApp())
      .get("/health")
      .set("Origin", "https://example.com")
      .expect("Access-Control-Allow-Origin", "*")
      .expect(200);
  });

  it("allows origins from a comma-separated CORS_ORIGIN list", async () => {
    process.env.CORS_ORIGIN = "http://localhost:5173, https://example.com";

    await request(createApp())
      .get("/health")
      .set("Origin", "https://example.com")
      .expect("Access-Control-Allow-Origin", "https://example.com")
      .expect(200);
  });

  it("returns CORS preflight options for the API", async () => {
    process.env.CORS_ORIGIN = "https://example.com";

    await request(createApp())
      .options("/api/energy-mix")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "GET")
      .expect("Access-Control-Allow-Origin", "https://example.com")
      .expect("Access-Control-Allow-Methods", "GET")
      .expect("Access-Control-Allow-Headers", "Content-Type")
      .expect("Access-Control-Max-Age", "86400")
      .expect(204);
  });
});
