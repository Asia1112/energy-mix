-- Up Migration
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE chargers (
  id text PRIMARY KEY,
  name text NOT NULL,
  location text NOT NULL
);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id text NOT NULL CONSTRAINT reservations_charger_fk REFERENCES chargers(id),
  owner_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz,
  CONSTRAINT reservations_future_start CHECK (start_at > created_at),
  CONSTRAINT reservations_duration CHECK (
    end_at - start_at BETWEEN interval '1 hour' AND interval '6 hours'
    AND mod(extract(epoch FROM end_at - start_at), 3600) = 0
  ),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    charger_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (cancelled_at IS NULL)
);

CREATE INDEX reservations_owner_start_idx ON reservations (owner_id, start_at);

-- Down Migration
DROP TABLE reservations;
DROP TABLE chargers;
