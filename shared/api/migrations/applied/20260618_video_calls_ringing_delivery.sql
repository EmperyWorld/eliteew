-- EliteEW · video_calls ringing delivery + missed reason (1:1 accept gate)
ALTER TABLE video_calls
    ADD COLUMN IF NOT EXISTS ringing_delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS missed_reason TEXT;
