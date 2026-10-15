-- FoFline W5: allow build_channel=fofline on desktop_client_runtime_presence
-- (presence heartbeat client_channel=fofline maps into build_channel).
-- Related: documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §6.3 / W5

ALTER TABLE desktop_client_runtime_presence
    DROP CONSTRAINT IF EXISTS desktop_client_runtime_presence_build_channel_check;

ALTER TABLE desktop_client_runtime_presence
    ADD CONSTRAINT desktop_client_runtime_presence_build_channel_check
    CHECK (
        build_channel IS NULL
        OR build_channel IN ('rpm', 'nsis', 'unknown', 'fofline')
    );
