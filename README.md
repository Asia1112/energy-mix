# Energy Mix UK

Explore Great Britain's electricity mix, find a cleaner EV charging window and reserve a charger. The [React frontend](frontend/) uses the [Express API](backend/), which reads forecasts from the Carbon Intensity API and stores reservations in PostgreSQL.

## Features

- Compare the energy mix for up to three London calendar days. The charts highlight the day with the highest clean energy share and show all tied days. Use the shared legend to highlight fuels across the charts.
- Find the cleanest window for one to six hours. **Book this time** fills in the date, start time and duration. Choose a charger and confirm with **Book charger**.
- Browse booked times by week or month. Select today or a future day to fill the form. Past dates are crossed out and can be selected to view booking history.
- View and cancel bookings in **My reservations**. The guest session survives a page reload.

The interface supports Polish and English, light and dark themes, and day-first date entry. Times are displayed in `Europe/London` with GMT or BST. The form offers start times in half-hour increments.

## Run locally

Use Node.js 24 and npm. Run the commands below from the repository root and keep the backend and frontend running in separate terminals.

### 1. Set up PostgreSQL

Use an existing Neon database or start a local PostgreSQL instance. In a backend checkout linked to the intended Neon project and branch, run `neon deploy` from `backend/` to apply [the Neon configuration](backend/neon.ts) and pull the database settings. You can also copy the pooled and direct URLs from the Neon console.

For a disposable local database, run:

```bash
docker run --rm --name energy-mix-postgres \
  -e POSTGRES_DB=energy_mix -e POSTGRES_PASSWORD=local_dev \
  -p 127.0.0.1:5432:5432 postgres:16-alpine
```

Copy [the backend env example](backend/.env.example) to `backend/.env` for local PostgreSQL and set `DATABASE_URL=postgresql://postgres:local_dev@localhost:5432/energy_mix`. For Neon, use the pulled `backend/.env.local` or `backend/.env`.

| Backend variable             | Purpose                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`               | PostgreSQL connection for the API. Use the pooled URL on Neon.                 |
| `DATABASE_URL_UNPOOLED`      | Optional direct URL for migrations. Defaults to `DATABASE_URL`.                |
| `RESERVATION_SESSION_SECRET` | Stable signing secret of at least 32 characters for guest cookies.             |
| `PORT`                       | HTTP port. Defaults to `3000`.                                                 |
| `CORS_ORIGIN`                | Allowed origins for cross-origin reads. Accepts `*` or a comma-separated list. |
| `CARBON_API_BASE_URL`        | Forecast API base URL. Defaults to `https://api.carbonintensity.org.uk`.       |

Generate a signing secret with the command below and save it as `RESERVATION_SESSION_SECRET` in the backend env file. Keep database credentials and the secret outside Git. Process environment variables take precedence over `.env`, followed by `.env.local`.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 2. Start the backend

```bash
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run build
npm --prefix backend start
```

The [migrations](backend/migrations/) create the tables and seed three chargers in London, Manchester and Edinburgh. The API listens at `http://localhost:3000` by default. Use `npm --prefix backend run dev` for automatic restarts. The energy and health routes also run without database and reservation settings.

### 3. Start the frontend

```bash
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open `http://localhost:5173` or the URL printed by Vite. The default backend URL is `http://localhost:3000`. To use a different backend, copy [the frontend env example](frontend/.env.example) to `frontend/.env` and set `VITE_API_URL`.

To try the reservation flow, book a future slot, then book the same charger at the same time to see the conflict message. Cancel the first booking in **My reservations** to free the slot.

## API and design decisions

| Method and path                              | Result                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /health`                                | Process health status.                                                                     |
| `GET /api/energy-mix`                        | Daily generation averages and clean energy shares for up to three London calendar days.    |
| `GET /api/charging-window?hours=3`           | Start, end and clean energy share for the highest-scoring forecast window.                 |
| `GET /api/chargers`                          | Charger IDs, names and locations.                                                          |
| `GET /api/chargers/:id/bookings?from=…&to=…` | Active booking times intersecting the requested range.                                     |
| `POST /api/reservation-session`              | `204` with a signed guest cookie. Sending an existing valid cookie refreshes that session. |
| `GET /api/reservations`                      | Reservations for the current guest, including cancelled records.                           |
| `POST /api/reservations`                     | `201` with the saved reservation, or `409` if the charger is booked.                       |
| `DELETE /api/reservations/:id`               | `204` for the owner, including repeat cancellations.                                       |

The charging-window search uses contiguous half-hour forecast intervals over the next 48 hours, including windows across midnight. London calendar days align the forecasts with the region they describe. Energy endpoints return `502` on upstream failure and `503` when there is insufficient data.

Create a reservation by sending `chargerId`, a future ISO 8601 `startAt` with an explicit offset or `Z`, and `durationHours` as a whole number from one to six. The backend calculates the end and returns UTC timestamps. PostgreSQL prevents overlapping bookings for the same charger, even during concurrent requests. Back-to-back bookings and simultaneous bookings on different chargers are allowed. Cancellation preserves the record and frees the slot.

Example reservation body:

```json
{
  "chargerId": "london-kings-cross",
  "startAt": "2030-07-17T13:30:00+01:00",
  "durationHours": 3
}
```

The signed HttpOnly cookie identifies a guest without requiring registration. Reuse the same cookie when testing private routes manually. A missing or invalid session yields `401`, and an attempt to cancel another guest's reservation yields `404`.

## Tests

```bash
npm --prefix frontend test
npm --prefix backend test
```

Frontend tests focus on booking interactions, including recommending a time without submitting it, displaying conflicts, updating the calendar after cancellation and handling London clock changes. Backend tests cover forecast calculations, date boundaries, validation and HTTP responses. Run `npm run lint` and `npm run format:check` from either app directory to check its code.

The reservation integration tests use PostgreSQL to verify concurrent conflicts, session isolation and reuse of a cancelled slot. Create a dedicated test database and run:

```bash
export TEST_DATABASE_URL='postgresql://user:password@localhost:5432/energy_mix_test'
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL_UNPOOLED="$TEST_DATABASE_URL" npm --prefix backend run db:migrate
npm --prefix backend test -- --runInBand
```

## Deployment

Build the frontend with `npm --prefix frontend run build` and publish `frontend/dist/`. Vite proxies `/api` in development and preview. On the public host, forward `/api/*` to Express on the same HTTPS origin so browsers keep the reservation cookie. Set the frontend's build-time `VITE_API_URL` to the public base URL for energy requests. If it points to another origin, add the frontend origin to the backend's `CORS_ORIGIN`.

Build the backend image from the repository root:

```bash
docker build -t energy-mix-backend ./backend
```

Inject the database URLs and signing secret through the backend host. Run `npm run db:migrate` from the backend image before starting a release. The image listens on port `3000` by default, and the guest cookie is Secure in production.
