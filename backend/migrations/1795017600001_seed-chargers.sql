-- Up Migration
INSERT INTO chargers (id, name, location)
VALUES
  ('london-kings-cross', 'King’s Cross', 'London'),
  ('manchester-piccadilly', 'Piccadilly', 'Manchester'),
  ('edinburgh-waverley', 'Waverley', 'Edinburgh')
ON CONFLICT (id) DO NOTHING;

-- Down Migration
DELETE FROM chargers AS charger
WHERE charger.id IN ('london-kings-cross', 'manchester-piccadilly', 'edinburgh-waverley')
  AND NOT EXISTS (
    SELECT 1 FROM reservations WHERE charger_id = charger.id
  );
