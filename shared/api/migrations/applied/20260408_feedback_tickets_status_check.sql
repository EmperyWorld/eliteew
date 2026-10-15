-- Enforce feedback ticket status values at DB level (aligned with VALID_FEEDBACK_STATUS in API).

ALTER TABLE feedback_tickets
	DROP CONSTRAINT IF EXISTS feedback_tickets_status_check;

ALTER TABLE feedback_tickets
	ADD CONSTRAINT feedback_tickets_status_check
	CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
