# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — browser OIDC reuse_detected kick loop after SSO.
# ---

# Browser OIDC: login then kick with «Срок входа истёк»

| Field | Value |
|-------|--------|
| **product_id** | `eliteew-spa` |
| **status** | `contained` |
| **date** | `2026-09-26` |
| **also_affects** | — |
| **canon** | `documentation/product/FRONTEND-AUTH.md` |
| **commit** | — |

## Symptom

User signs in successfully, Desktop loads, then within seconds is sent back to login with «Срок входа истёк. Недавняя работа сохранена…». Re-login repeats the loop. Feels like a 10s session TTL; it is not.

## Failure layers

1. **Keycloak realm:** `revokeRefreshToken=true`, `refreshTokenMaxReuse=0` — second use of the same refresh token id → `Maximum allowed refresh token reuse exceeded`, then storm `Session doesn't have required client`.
2. **FE bootstrap:** browser `init()` always called `refreshAccessToken()` on stored tokens (mobile already skipped when AT valid).
3. **FE concurrency:** in-tab `refreshInFlight` only — no cross-tab Web Lock; second tab / remount could grant the same RT.
4. **UX copy:** Continuity W3 reused idle/max «expired» wording for `reuse_detected`.

## Root cause

**Primary (ops, 2026-09-26):** prod-core `.111` system clock was ~**10 hours behind** real UTC (`chronyd -Q` → `wrong by 36003s`; `NTP service: inactive`, `RTC in local TZ: yes`). Keycloak issues JWT `exp` from that clock; the browser uses real wall time → access token looks already expired → immediate refresh storm → under `refreshTokenMaxReuse=0` Keycloak returns reuse exceeded → Continuity session-ended.

**Secondary (FE):** eager refresh-token rotation on every cold init and missing cross-tab grant lock amplified the storm when multiple tabs/remounts raced the same RT.

## What we did

- Skip eager bootstrap refresh when AT has ≥70s left (`shouldEagerRefreshStoredSession`).
- Cross-tab `navigator.locks` + adopt newer persisted RT after lock (`keycloakOidcRefreshCrossTab.ts` / `oidcRefreshAccessToken`).
- Honest `loginFallback.sessionEndedReuse*` copy when `kind=reuse_detected`.
- Canon note in `FRONTEND-AUTH.md`; Vitest contract on skip/adopt.

## Recommendations

- Do **not** reintroduce eager `refreshAccessToken()` on every browser init.
- Do **not** weaken realm `refreshTokenMaxReuse=0` as the primary fix; keep rotation and fix the client races.
- When diagnosing «session expired in seconds», check Keycloak `REFRESH_TOKEN_ERROR` reason before changing SSO idle/max.

## Verification

```text
pnpm exec vitest run src/services/__tests__/keycloakOidcRefreshCrossTab.contract.test.ts
→ (run in same phase)
ssh 192.168.1.111 'podman logs --since=1h stack6-keycloak 2>&1 | rg "Maximum allowed refresh token reuse exceeded" | wc -l'
→ expect drop after SPA release for affected users
```

## Residual risk

`navigator.locks` absent in rare WebViews → falls back to in-tab single-flight only; multi-context race still possible there. Contained until edge SPA bake ships this change.
