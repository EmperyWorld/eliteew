# Desktop shell a11y — live Playwright E2E runbook

Living operator runbook for **authenticated** desktop-shell a11y E2E. Agent/CI sessions without storage **skip** live Playwright; Vitest a11y smoke still runs.

## Why live E2E is gated

| Need | Notes |
|------|--------|
| `MC_E2E_BASE_URL` | Public or LAN app origin (e.g. `https://app.eliteew.ru`) |
| Playwright storage state | `shared/web/frontend/e2e/.auth/` — repo ships only `.gitkeep`; operator must codegen a session |
| Flag | `DESKTOP_SHELL_E2E_RUN=1` |

Without storage, `pnpm run test:e2e:desktop-a11y` is expected to **skip** (not green live).

## Prep (operator)

1. From `shared/web/frontend`, generate auth storage (project Playwright conventions / `e2e` codegen for Keycloak login).
2. Place storage under `e2e/.auth/` as required by desktop shell gated specs.
3. Export base URL:

```bash
export MC_E2E_BASE_URL='https://app.eliteew.ru'   # or LAN equivalent
export DESKTOP_SHELL_E2E_RUN=1
```

4. Run:

```bash
cd shared/web/frontend
pnpm run test:e2e:desktop-a11y
```

Covers `desktop-shell-wave16-a11y.spec.ts` + **`desktop-shell-wave4-matrix.spec.ts`** (narrow × reduced-motion × low-GPU).

## Machine proof without auth (always)

```bash
cd shared/web/frontend
pnpm run test:desktop-shell-a11y
```

Includes dense overflow lock (`TaskbarPinnedAndWindowsStrip.dense.test.ts`: 12 windows → 7 visible + 5 titled overflow), Start/Settings a11y + Wave 4 Tab budgets, full-shell chrome / embedded journey map, Settings @390 stacked layout, typography token contract, FE UX metrics contract.

## Related

- [`DESKTOP-SHELL-A11Y-CHECKLIST.md`](DESKTOP-SHELL-A11Y-CHECKLIST.md) §14 dense overflow + Wave 4 + Autotests
- [`DESKTOP-MOBILE-EMBEDDED-SHELL.md`](DESKTOP-MOBILE-EMBEDDED-SHELL.md) — embedded allowlist
- [`DESKTOP-SHELL-E2E-CI.md`](DESKTOP-SHELL-E2E-CI.md)
- Specs: `e2e/desktop-shell-wave16-a11y.spec.ts`, `e2e/desktop-shell-wave4-matrix.spec.ts`
