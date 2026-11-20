# Energy Mix UK Frontend

React and TypeScript app for exploring Great Britain's electricity mix, finding a cleaner EV charging window and booking a charger. The [Express backend](https://github.com/Asia1112/energy-mix-backend) provides the energy forecasts and stores reservations in PostgreSQL.


## What you can do

- Compare the energy mix for today, tomorrow and the day after. The charts show the share of clean energy and highlight the cleanest day. Days tied at the top are all highlighted. The shared legend lets you highlight one or more fuels across the charts.
- Find the cleanest charging window for one to six hours. **Book this time** copies the recommended date, start time and duration into the reservation form. Choose a charger and confirm with **Book charger**.
- Browse booked times by week or month. Select today or a future day to fill the form, or select a past day to view its history. Past dates are crossed out.
- View and cancel your bookings in **My reservations**. Your guest session is stored in a signed browser cookie and survives a page reload.

The interface supports Polish and English and includes light and dark themes. Times are displayed in `Europe/London` with GMT or BST. Dates are day-first in both languages. The reservation date can be typed or selected from the calendar, and start times are offered in half-hour increments.

## Run locally

Use Node.js 24 and npm. Start the [backend](https://github.com/Asia1112/energy-mix-backend) with reservations enabled and its database migrations applied. It listens on `http://localhost:3000` by default.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173` or the URL printed by Vite. Set `VITE_API_URL` in `.env` if the backend runs at a different base URL. The default is `http://localhost:3000`.

To test reservations manually, select a charger and a future date, then book a time. The booking should appear in the calendar and **My reservations**. Try booking the same charger for the same time to see the conflict message. Cancel the original booking and check that the calendar slot is free again.

## Build and deployment

```bash
npm run build
npm run preview
```

The production build is written to `dist/`. Vite proxies `/api` to the backend during development and preview. When serving `dist/` on a public host, configure that host to forward `/api/*` to Express on the same public origin. The browser uses those relative paths to retain the guest session cookie. Set the build-time `VITE_API_URL` to the public base URL used by the energy requests. If it points to a separate origin, allow the frontend origin in the backend's `CORS_ORIGIN`.

## Tests

```bash
npm test
npm run lint
npm run format:check
```

Vitest and React Testing Library cover the interaction paths that can affect a booking. The tests verify that a recommendation fills the form without submitting it, that conflicts are shown, and that booking and cancellation refresh the calendar and reservation list. They also cover day-first date input and London clock changes, where the same local start time can occur twice.
