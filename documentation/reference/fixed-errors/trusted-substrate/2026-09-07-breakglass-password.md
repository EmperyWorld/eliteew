# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: break-glass Login incorrect for documented eliteew-ts password.
# ---

# trusted-substrate — break-glass password rejected

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **product_id** | `trusted-substrate` |
| **symptom** | Ctrl+Alt+F2 → `eliteew-ts` / `eliteew-ts-change-me` → Login incorrect |
| **failure layer** | Kickstart user password application (Anaconda) |
| **root cause** | `user --password=…` without `--plaintext`; Anaconda may treat the string as a crypt hash → account not usable with the documented passphrase; root also locked (`rootpw --lock`) |
| **fix** | `user … --plaintext` + `%post` `chpasswd` for `eliteew-ts:eliteew-ts-change-me`; selftest locks both |
| **verification** | Metal F2 login works; selftest-w1 requires `--plaintext` and `chpasswd` |
| **also_affects** | Any ops rescue that assumed README password |

## Recommendations

- Always pair kickstart `--password=` with `--plaintext` or `--iscrypted <hash>`.
- Keep a `%post chpasswd` for pilot images where break-glass must match docs.
