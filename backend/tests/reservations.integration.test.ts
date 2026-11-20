import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("reservations on PostgreSQL", () => {
  let pool: Pool;
  let app: ReturnType<typeof createApp>;
  const chargerIds = [randomUUID(), randomUUID()];
  const [firstCharger, secondCharger] = chargerIds;
  const hourMs = 60 * 60 * 1000;
  const startTime = Math.ceil(Date.now() / hourMs) * hourMs + 24 * hourMs;
  const at = (hours: number) =>
    new Date(startTime + hours * hourMs).toISOString();

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    app = createApp({ pool, sessionSecret: randomUUID(), secureCookies: true });
    await pool.query(
      `INSERT INTO chargers (id, name, location)
       SELECT id, 'Integration test', 'London' FROM unnest($1::text[]) AS id`,
      [chargerIds]
    );
  });

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(
          "DELETE FROM reservations WHERE charger_id = ANY($1)",
          [chargerIds]
        );
        await pool.query("DELETE FROM chargers WHERE id = ANY($1)", [
          chargerIds
        ]);
      } finally {
        await pool.end();
      }
    }
  });

  async function openSession() {
    const response = await request(app)
      .post("/api/reservation-session")
      .expect(204);
    const cookies = response.headers["set-cookie"];
    expect(cookies[0]).toMatch(/; HttpOnly; Secure; SameSite=Strict/);
    return cookies[0].split(";")[0];
  }

  function book(
    cookie: string,
    chargerId: string,
    startAt: string,
    durationHours = 1
  ) {
    return request(app).post("/api/reservations").set("Cookie", cookie).send({
      chargerId,
      startAt,
      durationHours
    });
  }

  it("returns the seeded chargers and requires a signed session for private endpoints", async () => {
    const { body } = await request(app).get("/api/chargers").expect(200);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "london-kings-cross" }),
        expect.objectContaining({ id: "manchester-piccadilly" }),
        expect.objectContaining({ id: "edinburgh-waverley" })
      ])
    );

    await request(app).get("/api/reservations").expect(401);
    await request(app)
      .get("/api/reservations")
      .set("Cookie", `reservation_session=${randomUUID()}`)
      .expect(401);
    await request(app)
      .post("/api/reservation-session")
      .set("Sec-Fetch-Site", "cross-site")
      .expect(403);
  });

  it("allows one of two concurrent overlapping writes and returns only occupied times to the calendar", async () => {
    const [firstSession, secondSession] = await Promise.all([
      openSession(),
      openSession()
    ]);

    const requests = await Promise.all([
      book(firstSession, firstCharger, at(0)),
      book(secondSession, firstCharger, at(0))
    ]);
    expect(requests.map(({ status }) => status).sort()).toEqual([201, 409]);

    await book(firstSession, secondCharger, at(0)).expect(201);
    await book(firstSession, firstCharger, at(1)).expect(201);

    await request(app)
      .get(`/api/chargers/${firstCharger}/bookings`)
      .query({ from: at(0.5), to: at(1) })
      .expect(200)
      .expect([{ startAt: at(0), endAt: at(1) }]);
  });

  it("keeps reservations private and frees the slot after an idempotent cancellation", async () => {
    const [owner, other] = await Promise.all([openSession(), openSession()]);
    const { body: reservation } = await book(owner, firstCharger, at(5)).expect(
      201
    );

    const refreshed = await request(app)
      .post("/api/reservation-session")
      .set("Cookie", owner)
      .expect(204);
    expect(refreshed.headers["set-cookie"][0].split(";")[0]).toBe(owner);

    await request(app)
      .get("/api/reservations")
      .set("Cookie", owner)
      .expect(200)
      .expect([reservation]);
    await request(app)
      .get("/api/reservations")
      .set("Cookie", other)
      .expect(200)
      .expect([]);
    await request(app)
      .delete(`/api/reservations/${reservation.id}`)
      .set("Cookie", other)
      .expect(404);

    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app)
        .delete(`/api/reservations/${reservation.id}`)
        .set("Cookie", owner)
        .expect(204);
    }

    await request(app)
      .get(`/api/chargers/${firstCharger}/bookings`)
      .query({ from: at(5), to: at(6) })
      .expect(200)
      .expect([]);
    await book(other, firstCharger, at(5)).expect(201);
    const { body } = await request(app)
      .get("/api/reservations")
      .set("Cookie", owner)
      .expect(200);
    expect(body).toEqual([{ ...reservation, cancelledAt: expect.any(String) }]);
  });

  it("rejects unknown chargers, invalid timestamps, past starts and durations outside the allowed hours", async () => {
    const session = await openSession();
    await book(session, "unknown-charger", at(10)).expect(404);
    await book(session, firstCharger, "2099-02-30T12:00:00Z").expect(400);
    await book(session, firstCharger, "2020-01-01T00:00:00Z").expect(400);
    await book(session, firstCharger, at(10).slice(0, -1)).expect(400);
    await book(session, firstCharger, at(10), 0).expect(400);
    await book(session, firstCharger, at(10), 1.5).expect(400);
    await book(session, firstCharger, at(10), 7).expect(400);
    await book(session, firstCharger, at(10), 6).expect(201);

    await request(app)
      .get(`/api/chargers/${firstCharger}/bookings`)
      .query({ from: at(11), to: at(10) })
      .expect(400);
  });
});
