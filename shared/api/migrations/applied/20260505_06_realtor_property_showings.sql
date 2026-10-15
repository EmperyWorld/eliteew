-- Realtor Pro: rename legacy showings table and extend scheduling metadata.
-- Applied manually per EliteEW migrations/README.md after review.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'realtor_showings'
    )
       AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'realtor_property_showings'
    ) THEN
        ALTER TABLE realtor_showings RENAME TO realtor_property_showings;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS realtor_property_showings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    scheduled_at timestamp without time zone NOT NULL,
    status varchar(80) NOT NULL DEFAULT 'planned',
    notes text,
    duration_minutes integer,
    location_notes text,
    deal_id uuid REFERENCES professional_deals(id) ON DELETE SET NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

ALTER TABLE realtor_property_showings ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE realtor_property_showings ADD COLUMN IF NOT EXISTS location_notes text;
ALTER TABLE realtor_property_showings ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES professional_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_realtor_property_showings_user_scheduled
    ON realtor_property_showings(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_property_showings_property_scheduled
    ON realtor_property_showings(property_id, scheduled_at DESC);
