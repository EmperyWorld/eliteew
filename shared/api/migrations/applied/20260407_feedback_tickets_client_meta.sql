-- Optional client metadata for feedback tickets (build, UA, etc.)

ALTER TABLE feedback_tickets
	ADD COLUMN IF NOT EXISTS client_meta JSONB NULL;

COMMENT ON COLUMN feedback_tickets.client_meta IS 'Optional JSON from client (version, UA) for bug triage';
