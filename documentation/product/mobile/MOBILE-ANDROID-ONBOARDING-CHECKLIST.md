# Mobile Android — onboarding checklist

**Updated:** 2026-06-17 · **growth-004**

Operator/product checklist for first-session success. Maps to the inline Feed education rail backed by `MobileEducationCards` and dismissed via `MobileFeatureShellPreferences`.

## User milestones

| # | Milestone | Success signal | Education card id |
|---|-----------|----------------|-------------------|
| 1 | Complete profile | Avatar or display name set | `PROFILE_COMPLETE` |
| 2 | Enable notifications | OS permission granted + push token registered | `NOTIFICATIONS_ENABLE` |
| 3 | First friend | ≥1 accepted friend or sent request | `FIRST_FRIEND` |
| 4 | First chat message | ≥1 sent message in GAF chat | `FIRST_CHAT` |
| 5 | First UGS generation | Completed song or image job | `FIRST_UGS_GENERATION` |

## Operator verification (stack0 + device)

- [ ] New account can SSO login on prod flavor
- [ ] Profile save persists after restart
- [ ] FCM token `PUT profile/mobile-push-token` succeeds (check API logs)
- [ ] Friend request round-trip with second test user
- [ ] Chat send/receive between two users
- [ ] UGS hub loads stats; one lightweight generation or dry-run screen

## Metrics (future)

- `% users completing milestones 1–5 within 7 days`
- Drop-off screen from analytics events (see `pack-cloud/mobile/docs/OPERATOR-DASHBOARD-NOTES.md`)

## Related

- [MOBILE-ANDROID-USER-GUIDE.md](MOBILE-ANDROID-USER-GUIDE.md)
- [MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md](MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md)
- [MOBILE-ANDROID-RELEASE-RUNBOOK.md](MOBILE-ANDROID-RELEASE-RUNBOOK.md)
