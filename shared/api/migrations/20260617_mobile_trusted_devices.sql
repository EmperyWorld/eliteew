-- Mobile trusted-device binding foundation.
-- Private keys are generated and stored on the phone only.

CREATE TABLE IF NOT EXISTS public.mobile_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    stable_device_id TEXT NOT NULL,
    device_label TEXT NOT NULL DEFAULT 'Android device',
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('pending_binding', 'active', 'pending_admin_approval', 'revoked', 'expired')
    ),
    device_public_key_algorithm TEXT NOT NULL DEFAULT 'ed25519',
    device_public_key TEXT NOT NULL,
    device_public_key_fingerprint TEXT NOT NULL,
    wg_public_key TEXT NOT NULL,
    wg_public_key_fingerprint TEXT NOT NULL,
    wg_assigned_ip INET,
    wg_allowed_ips TEXT NOT NULL DEFAULT '10.88.88.1/32',
    wg_dns TEXT NOT NULL DEFAULT '10.88.88.1',
    wg_endpoint TEXT,
    wg_server_public_key TEXT,
    gaf_public_key_algorithm TEXT,
    gaf_public_key TEXT,
    gaf_public_key_fingerprint TEXT,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mobile_trusted_devices_unique_user_device UNIQUE (user_id, stable_device_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_trusted_devices_user_status
    ON public.mobile_trusted_devices (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_trusted_devices_wg_fingerprint
    ON public.mobile_trusted_devices (wg_public_key_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_trusted_devices_active_wg_ip
    ON public.mobile_trusted_devices (wg_assigned_ip)
    WHERE wg_assigned_ip IS NOT NULL AND status = 'active';

COMMENT ON TABLE public.mobile_trusted_devices IS
    'Trusted MobileAndroid devices. Stores public keys and metadata only; device/WG/GAF private keys never leave the phone.';

CREATE TABLE IF NOT EXISTS public.mobile_device_pairing_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    challenge_nonce TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'consumed', 'expired', 'cancelled')
    ),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_ip TEXT,
    created_user_agent TEXT,
    consumed_ip TEXT,
    consumed_user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_device_pairing_challenges_user_status
    ON public.mobile_device_pairing_challenges (user_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_device_pairing_challenges_expires
    ON public.mobile_device_pairing_challenges (expires_at);

COMMENT ON TABLE public.mobile_device_pairing_challenges IS
    'Short-lived single-use mobile device pairing challenges. Raw pairing codes are not stored.';

CREATE TABLE IF NOT EXISTS public.mobile_device_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    old_device_id UUID REFERENCES public.mobile_trusted_devices (id) ON DELETE SET NULL,
    new_device_id UUID REFERENCES public.mobile_trusted_devices (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_old_device' CHECK (
        status IN (
            'pending_old_device',
            'pending_admin',
            'pending_user_email',
            'ready_for_new_device',
            'completed',
            'rejected',
            'expired',
            'cancelled'
        )
    ),
    transfer_public_key TEXT NOT NULL,
    transfer_public_key_algorithm TEXT NOT NULL DEFAULT 'x25519',
    transfer_public_key_fingerprint TEXT NOT NULL,
    transfer_nonce TEXT NOT NULL,
    encrypted_transfer_blob TEXT,
    encrypted_transfer_blob_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    old_device_signature TEXT,
    old_device_confirmed_at TIMESTAMPTZ,
    admin_approved_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    admin_approved_at TIMESTAMPTZ,
    admin_rejected_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    admin_rejected_at TIMESTAMPTZ,
    admin_reject_reason TEXT,
    email_confirmation_token_hash TEXT,
    email_confirmation_sent_at TIMESTAMPTZ,
    email_confirmation_expires_at TIMESTAMPTZ,
    email_confirmation_to TEXT,
    email_confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_device_transfer_requests_user_status
    ON public.mobile_device_transfer_requests (user_id, status, created_at DESC);

COMMENT ON TABLE public.mobile_device_transfer_requests IS
    'No-server-recovery device transfer requests. Encrypted transfer blobs must be opaque to the server.';

CREATE TABLE IF NOT EXISTS public.mobile_device_audit_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.mobile_trusted_devices (id) ON DELETE SET NULL,
    pairing_challenge_id UUID REFERENCES public.mobile_device_pairing_challenges (id) ON DELETE SET NULL,
    transfer_request_id UUID REFERENCES public.mobile_device_transfer_requests (id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok', 'denied', 'failed')),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_device_audit_events_user_created
    ON public.mobile_device_audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_device_audit_events_type_created
    ON public.mobile_device_audit_events (event_type, created_at DESC);

COMMENT ON TABLE public.mobile_device_audit_events IS
    'Append-only audit for trusted-device binding, transfer, revoke, and key rotation. No raw keys, tokens, pairing codes, or plaintext.';
