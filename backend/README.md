# Energy Mix UK Backend

Express and TypeScript API for the [Energy Mix UK frontend](https://github.com/Asia1112/energy-mix-frontend). It reads Great Britain's generation forecasts from the Carbon Intensity API, recommends a charging window and stores charger reservations in PostgreSQL.

## Run locally

Use Node.js 24 and npm. Install dependencies with `npm ci`. Set up either a Neon database or a local PostgreSQL database to use reservations.

### Neon

From a backend checkout linked to the intended project and branch, run `neon deploy` to apply the settings in `neon.ts` and retrieve the connection settings. You can also copy the pooled and direct connection strings from the Neon console. The app uses the pooled URL and the migration command prefers the direct URL.

### Local PostgreSQL

For a disposable local database, run this command in a separate terminal and leave it running.

```bash
docker run --rm --name energy-mix-postgres \
  -e POSTGRES_DB=energy_mix -e POSTGRES_PASSWORD=local_dev \
  -p 127.0.0.1:5432:5432 postgres:16-alpine
```

Copy `.env.example` to `.env` and set `DATABASE_URL=postgresql://postgres:local_dev@localhost:5432/energy_mix`. The same URL can be used for migrations.

### Environment and startup

Process environment variables take precedence. The backend and migration command then load `.env` followed by `.env.local` for any settings that are still unset.

| Variable                     | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection for the API. Use the pooled URL on Neon.                   |
| `DATABASE_URL_UNPOOLED`      | Optional direct URL for migrations. Migrations fall back to `DATABASE_URL`.      |
| `RESERVATION_SESSION_SECRET` | Stable secret of at least 32 characters for signing guest cookies.               |
| `PORT`                       | HTTP port. Defaults to `3000`.                                                   |
| `CORS_ORIGIN`                | Allowed origins for cross-origin reads. Accepts `*` or a comma-separated list.   |
| `CARBON_API_BASE_URL`        | Carbon Intensity API base URL. Defaults to `https://api.carbonintensity.org.uk`. |

Generate a secret and save it in your local env file or the backend host's environment. Keep the value stable across restarts so existing guest sessions continue to work.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```bash
npm run db:migrate
npm run build
npm start
```

Migrations create the tables and seed three chargers in London, Manchester and Edinburgh. The API is available at `http://localhost:3000`. For development with automatic restarts, use `npm run dev`. When both `DATABASE_URL` and `RESERVATION_SESSION_SECRET` are unset, the health and energy routes are available and reservation routes are disabled.

## API

| Method and path                    | Result                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /health`                      | Process health status.                                                                                          |
| `GET /api/energy-mix`              | Daily generation averages and the share of clean energy for up to three London calendar days.                   |
| `GET /api/charging-window?hours=3` | Start, end and average clean energy share for the cleanest available forecast window of the requested duration. |

The charging-window endpoint searches the next 48 hours in contiguous half-hour intervals, including windows across midnight. It accepts one to six whole hours. The mix uses the intervals supplied by the forecast and groups them in `Europe/London`. Energy endpoints return `502` when the upstream API fails and `503` when there is insufficient data to produce a result.

### Reservations

| Method and path                              | Result                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/chargers`                          | Charger IDs, names and locations.                                                    |
| `GET /api/chargers/:id/bookings?from=…&to=…` | Start and end times for active bookings that intersect the requested range.          |
| `POST /api/reservation-session`              | `204` and a signed guest cookie. Refreshes the same session when its cookie is sent. |
| `GET /api/reservations`                      | Reservations for the current guest, including cancelled records.                     |
| `POST /api/reservations`                     | `201` with the saved reservation, or `409` when the requested charger is booked.     |
| `DELETE /api/reservations/:id`               | `204` after cancellation, including repeats by the same guest.                       |

Start a guest session before using the private reservation endpoints and reuse its cookie for listing, creating and cancelling. Requests without a valid session receive `401`. An attempt to cancel another guest's reservation receives `404`.

A creation request takes a charger ID, a future ISO 8601 start with an explicit offset or `Z`, and a duration of one to six whole hours.

```json
{
  "chargerId": "london-kings-cross",
  "startAt": "2030-07-17T13:30:00+01:00",
  "durationHours": 3
}
```

The API computes the end time and returns UTC timestamps. Cancelling records the cancellation time and frees the slot.

### Design decisions

- London calendar days align the generation forecast with the region it describes. The API uses timezone-aware timestamps for reservations so a booking refers to the same instant during clock changes.
- A PostgreSQL exclusion constraint rejects overlapping bookings for the same charger, including when requests arrive simultaneously. Back-to-back bookings and simultaneous bookings on different chargers are allowed.
- A signed HttpOnly cookie identifies a guest without requiring registration. Sessions are specific to the browser, and the cookie is Secure in production. Serve the frontend and reservation API on the same public origin by forwarding `/api/*` to Express.

## Tests

```bash
npm test
npm run lint
npm run format:check
```

The Jest suite covers interval averaging, London day boundaries, charging-window continuity, input validation and HTTP responses. The reservation integration tests run against PostgreSQL to verify concurrent conflicts, owner isolation and reuse of cancelled slots. After creating a dedicated test database, run:

```bash
export TEST_DATABASE_URL='postgresql://user:password@localhost:5432/energy_mix_test'
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL_UNPOOLED="$TEST_DATABASE_URL" npm run db:migrate
npm test -- --runInBand
```

## Docker and deployment

```bash
docker build -t energy-mix-backend .
```

The production image includes the API and the migration command. Inject the database URLs and signing secret as environment variables. Run `npm run db:migrate` before starting the new release. The image exposes port `3000` and starts the API by default. Serve the public app over HTTPS to use the production guest cookie.

For example, with the backend variables exported and PostgreSQL reachable from Docker:

```bash
docker run --rm -e DATABASE_URL -e DATABASE_URL_UNPOOLED \
  energy-mix-backend npm run db:migrate
docker run --rm -e DATABASE_URL -e RESERVATION_SESSION_SECRET \
  -p 3000:3000 energy-mix-backend
```
