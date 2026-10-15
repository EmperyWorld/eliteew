# Web SSO session continuity — target contract

**Status:** locked (operator 2026-08-30) — implement from this SoT  
**Edition:** cloud · **Entrance:** shared-only  
**Process plans:** session continuity — `documentation/plans/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` *[operator-local process plan; gitignored — not living canon]* · tab ownership — `documentation/plans/platform/BROWSER-TAB-SESSION-OWNERSHIP-PLAN.md` *[operator-local process plan; gitignored — not living canon]* · BFF migration — `documentation/plans/platform/BROWSER-OIDC-BFF-MIGRATION-PLAN.md` *[operator-local process plan; gitignored — not living canon]*  
**Implementation order:** continuity W0→W4 first; tab ownership after continuity W0/W3 derisk; BFF deferred.

## Product promise

The cloud browser Desktop does not unexpectedly restart, discard user work, or
silently replace another active tab because an access token rotates, a browser
is backgrounded, or an SSO boundary is reached. Legitimate re-authentication is
explicit, recoverable, and preserves the user’s intended route and durable
workspace state.

## Browser session policy

The target browser `empery-web` policy is:

| Policy | Normal session | Explicit Remember Me |
|---|---:|---:|
| Access-token lifetime | 15 min | 15 min |
| SSO idle timeout | 12 h | 14 d |
| SSO maximum lifespan | 24 h | 14 d |
| Refresh token | rotated, single use | rotated, single use |

`SSO Session Max` is an intentional security boundary. A refresh cannot extend
it. Because Keycloak may validate client session limits against realm policy,
the approved implementation must record the effective policy for every realm
client class; it must not silently alter other editions. Sensitive actions
retain independent fresh-auth checks regardless of this table.

## Token and refresh invariants

1. A web access token is refreshed before expiry while the browser executes;
   foreground/resume triggers an immediate validity check.
2. A refresh operation is single-flight per active session. Concurrent callers
   share its result; none may reuse the previous refresh token.
3. A successful refresh only patches authenticated realtime credentials. It
   must not disconnect/reconnect Socket.IO solely due to token rotation.
4. A browser pause/network failure is not terminal authentication failure.
5. Keycloak `Session not active`, explicit logout, and confirmed replacement
   are terminal states. They clear auth credentials through one coordinated
   teardown and never start an automatic login loop.
6. Browser diagnostics never include bearer access tokens, refresh tokens,
   authorization codes, or session cookies.

## Remember Me

The browser persistence choice and Keycloak Remember Me are distinct controls
until a separately specified, authenticated Keycloak handoff exists:

1. the SPA control governs browser token persistence only;
2. the Keycloak login form's Remember Me control governs Keycloak's persistent
   SSO cookie and matching timeout policy.

The interface must not represent a local-storage preference as long-lived
Keycloak login. Any future unified control must define a server-validated
handoff, expiration, failure behaviour, and test evidence before replacing this
rule. On shared devices each control must state its durable effect.

## Terminal session recovery

Before terminating an active browser session, the product:

1. attempts a bounded flush of registered drafts and Desktop shell state to an
   encrypted, principal-bound, server-side recovery capsule;
2. records a redacted terminal reason;
3. displays the preserved-work result and one action to sign in;
4. after successful sign-in, restores the same-principal intended route and
   eligible state from a single-use capsule, then deletes it.

No auth failure may invoke a hard browser reload as its recovery action.
Browser cache teardown may clear RAM/IndexedDB but must not destroy the
recovery capsule; its retention, encryption, and deletion are audited
server-side.

## Browser tab ownership

1. A browser profile has at most one active Desktop owner per authenticated
   principal. Additional Desktop tabs are followers.
2. A follower does not bootstrap Desktop state or open a competing Socket.IO
   session.
3. Before OIDC, a follower may discover only the presence of an active
   same-origin owner. It offers transfer for that active account or a
   fresh-auth “use another account” path; it never assumes tab-scoped storage
   reveals the owner's credentials.
4. A fresh-auth callback for a different principal opens a different ownership
   scope. A callback for the same principal requires a transfer/recovery proof
   and otherwise returns typed replacement-pending.
5. Ownership transfer requires a user decision from the current owner, then a
   single-use, short-lived, principal-bound server-validated proof.
6. If the owner is unavailable, recovery requires a separate explicit user
   confirmation; elapsed time alone is not authorization.
7. A rejected, expired, replayed, cross-principal, or cross-client-class
   transfer always fails closed.
8. The old owner is terminated only after the server accepts the transfer.

## Explicit exclusions

This contract covers browser `empery-web` only. MobileAndroid, Tauri Desktop,
and FoFline retain their independently documented native token/session
ownership contracts. The eventual BFF migration may change browser token
storage, but not these user-facing continuity guarantees. It is proposed
target state: the current multi-tab REST/UI policy remains in force until the
tab-ownership plan's transition release explicitly supersedes it.

## Required acceptance evidence

- Keycloak policy readback after every realm-policy change;
- narrow browser unit tests for refresh and recovery result mapping;
- backend tests for transfer proof binding, replay, expiry, and conflict;
- two-tab browser smoke (allow, reject, owner unavailable);
- session expiry smoke using short test-only timeouts;
- no hard navigation in token-refresh and terminal-recovery traces.
