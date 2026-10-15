# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — precheck idempotency key authorized a different binding ticket.
# ---

# FoFline OS login 403 — precheck cache is not the presented ticket

| Field | Value |
|-------|--------|
| **product_id** | `desktop-client` |
| **status** | `contained` |
| **date** | `2026-09-20` |
| **also_affects** | `desktop-shell` |
| **canon** | `documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md` |
| **commit** | — |

## Symptom

OS login as an enabled, email-verified user returns Keycloak access denied. API log: `POST /api/v1/desktop-client/auth/internal/commit` **403** `auth_policy_denied` in a few milliseconds, after `POST .../internal/precheck` **200**. Caller is the Keycloak SPI on the internal network, not the seat.

## Failure layers

- Keycloak SPI sends the auth-session id as the idempotency key for both precheck and commit, and then commits the ticket it just presented.
- API `DesktopClientAuthBindingService.precheck` returned the stored allow for that key without checking the ticket hash.
- The new ticket never received `keycloak_auth_session_id`. Commit denies that empty session. The public body stays opaque, so the log does not name the check.
- License channel and the user account were not the deny.

## Root cause

Idempotency replay was keyed only by the Keycloak auth-session id. A later ticket in the same session inherited the previous ticket's allow, and the unique key could not be written onto the new ticket.

## What we did

- Replay of precheck and commit returns the stored outcome only when `ticket_hash` matches.
- A key that sits on another ticket is cleared in the same transaction, then the presented ticket is processed and stores the key.
- Public `auth_policy_denied` body is unchanged. Keycloak SPI was not rebuilt.

## Recommendations

- Do not treat a precheck HTTP 200 as proof the presented ticket is session-bound. Same-ticket replay must stay.
- Do not delete tickets or restart Keycloak to unblock one login. That hides the next ticket in the same session.
- Do not ship this as a FoFline SPA pack. The lock is the stack0 API.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_desktop_client_auth_binding.py -q
→ 23 passed
```

Covers same-ticket replay, a second ticket with the same session key (session written, commit not missing-session), and a commit key that must not replay another ticket.

## Residual risk

Prod-core is still running the old API. The next OS login still returns 403 until a stack0 API deploy from command-center. Not verified on the seat.
