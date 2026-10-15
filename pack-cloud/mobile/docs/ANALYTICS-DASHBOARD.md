# Mobile Android · Analytics dashboard notes

**Super Roadmap analytics-005**

## Event schema

Canonical names live in `MobileTelemetryEventSchema` (`MobileTelemetry.kt`):

| Event | When |
|-------|------|
| `open_screen` | Nav route change (deduped 2s) |
| `tab_selected` | Bottom tab tap |
| `auth_sign_in` / `auth_sign_out` | Session lifecycle |
| `chat_opened` | GAF thread open |
| `ugs_tool_opened` | AI hub tool entry |
| `friend_report` / `friend_block` | Social safety flows |
| `apk_update_check` / `apk_update_download` | OTA |
| `app_trim_memory` / `app_on_low_memory` | Memory pressure |

Base params on every event: `ew_flavor`, `ew_build`, `ew_ver`.

## Privacy

- Use `MobileTelemetryPrivacy` at call sites; respects shell pref `analytics_enabled`.
- Tokens, JWT, email, IP, UUID scrubbed before Firebase.
- Crashlytics breadcrumbs via `MobileTelemetry.leaveBreadcrumb` (scrubbed).

## Operator dashboard (Firebase)

1. **DebugView** — dev flavor, filter `ew_flavor=dev`.
2. **Events** — validate `open_screen` route cardinality (<40 chars, no query secrets).
3. **Crashlytics** — breadcrumbs prefixed `breadcrumb:`; no Bearer strings in logs.

## Profile runtime diagnostics (analytics-004)

Profile → Runtime · diagnostics: build/socket/motion toggles; does not export raw FCM or access tokens.
