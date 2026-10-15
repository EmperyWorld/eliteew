# Engineering Governance Manifesto — Anti-Degradation Control

**Status:** Active process canon (2026-07-26).
**Evidence:** Git retrospective audit (Health ~47%, fix-доля ~36%, Architecture-Induced Instability in ewa/desktop/agentic).
**Complements:** `cause-first-intake.mdc`, `domain-boundary-gate.mdc`, `verified-proposal-protocol.mdc`, `eliteew-user-workflow-preferences.mdc`, `eliteew-product-editions-app-platform.mdc` — **не заменяет** их; добавляет метрики и бюджеты против fix-storm / shotgun / god-files.

**Product shape:** prefer Kernel + App Manifest modules over shotgun across apps or resurrecting soft-retired product trees — [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md).

## 1. Манифест (кратко)

1. **Границы важнее скорости.** Фича, ломающая порт модуля, — дефект, даже если UI «зелёный».
2. **Cause before chrome.** i18n / polish / assertion-only PR не закрывают волну без cause-layer (см. cause-first).
3. **Один владелец состояния.** UI prefs ≠ server truth; chrome API ≠ global visual god-file.
4. **Бюджет сложности — merge bar.** Превышение LOC/coupling без плана split → **блок**.
5. **Fix-storm = сигнал архитектуры**, не «нормальный polish». После N фиксов в том же модуле — стоп и redesign slice.

---

## 2. Anti-Pattern Detection

### 2.1 Shotgun Surgery

**Сигнал:** одно логическое изменение (тема портала, scroll ownership, dismiss, HITL gate) требует правок в **≥5 несвязанных** feature-файлах или **≥3 доменах** matrix без shared-contract path.

**Правила:**

| Detect | Action |
|--------|--------|
| Diff touches ≥5 apps for chrome/theme/portal | Reject; move fix into Shell API / registry |
| Diff touches FE lifecycle + ad-hoc storage keys | Reject; SLM only ([SHELL-LIFECYCLE-AND-CHROME-SSOT.md](../product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md)) |
| Same semantic change in BE scrub + FE scrub without shared golden | Require one contract test pair |

**Agent/CI hint (manual until hook):** before Commit Package, count distinct `appComponent` / feature folders in chrome-related diff. Soft product-tree budget: `eliteew-shotgun-budget.mdc` + `validate-agent-policy.py` warn on `git commit` when dirty tree spans more than six product top-level dirs.

### 2.2 Fix-storm (Architecture-Induced Instability)

**Сигнал:** после `feat(...)` в зоне A за **14 дней** ≥**3** коммита `fix|hotfix|bug` в той же зоне (path prefix).

**Зоны мониторинга (высокий риск):**

- `shared/api/ewa_platform/agentic/`
- `shared/web/frontend/src/features/ewa/`
- `shared/web/frontend/src/pages/Desktop/`

**Правила:**

| Detect | Action |
|--------|--------|
| 3-й fix в зоне за 14d после feat | Обязательный **Stabilization Note** в PR/ответе: root cause layer + stop-the-line plan |
| 5-й fix | **Feature freeze** зоны до завершения K/U phase slice из redesign docs |
| Fix only changes copy/i18n after behavioral feat | Treat as Lock — must cite prior Cause commit |

**Не путать** с легитимным dual-line deploy hotfix вне product modules.

### 2.3 God-object growth

**Сигнал:** файл **≥800 LOC** получает net +LOC в feat PR без сопутствующего extract.

**Правила:** см. §3 Complexity Budget. LOC growth lock for named hot files: [GOD-FILE-LOC-BASELINES.md](GOD-FILE-LOC-BASELINES.md) (`bash docker/scripts/eliteew-god-file-loc-guard.sh`).

---

## 3. Complexity Budget

| Class | Soft cap | Hard cap | Notes |
|-------|----------|----------|-------|
| Agentic coordinator `loop.py` | 400 | 600 | Target after [EWA-AGENTIC-KERNEL-REDESIGN.md](../product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md) |
| Kernel Decision / FSM / Scheduler module | 800 | 1000 | Split before crossing hard |
| Desktop shell registry / SLM module | 400 | 600 | Catalog data may be separate generated/static lists |
| FE feature panel / app root | 800 | 1000 | Align cause-first god-file rule |
| Any new file in hot zones | 400 | 800 | Prefer grow by new file, not inflate |

**Coupling budget (hot zones):**

- Decision Engine: **0** imports of FSM transition apply / tool bridge.
- Feature app: **0** imports of `getDesktopPortalShellProps` (use Shell API).
- Companion UX: **0** direct `localStorage` keys for surface lifecycle (SLM only).

**Fan-out:** новый публичный symbol в god-file без re-export facade — запрещён; сначала extract.

---

## 4. Definition of Done — Feature Checklist

Перед «готово» / Commit Package для фич в monitored zones:

### 4.1 State & invariants

- [ ] Назван **owner** состояния (server SoT vs SLM vs ephemeral UI).
- [ ] HITL/gate: нет side-effect без confirm (agentic) **или** явно задокументирован auto-accept.
- [ ] Dismiss/collapse не отменяет run; collapse не уничтожает transcript.
- [ ] Failure/Edge-Case Matrix (offline, dual-flag, permission, regression cmd) заполнена.

### 4.2 Anti-shotgun / anti-storm

- [ ] Chrome/portal/scroll change localized to shell/registry **или** обоснован exception.
- [ ] Нет второго storage для того же prefs ключа.
- [ ] Если это N-й fix после недавнего feat — Stabilization Note приложен.

### 4.3 Complexity

- [ ] Нет нарушения hard LOC cap без extract в том же PR.
- [ ] Новые imports не нарушают coupling budget (§3).
- [ ] Layer B/C verification если сменился intent/action/contract (`agent-code-verification.mdc`).

### 4.4 Proof

- [ ] Узкий pytest и/или vitest на границе контракта (не «весь suite»).
- [ ] Doc-sync living canon в той же фазе (`eliteew-doc-sync`).
- [ ] Commit Package готов; commit только после approval.

### 4.5 Explicit non-goals в PR

- [ ] Не «顺便» раздувать `EWRPGeneratorMain` / `desktopVisualSystem` / `loop.py` / `step_executor.py` (historical WorkflowBuilder shell is **retired** — do not resurrect without a product task).

### 4.6 Bus factor (second-pass)

For non-trivial edits to **`shared/api/ewa_platform/agentic/kernel/**`** or **`shared/web/frontend/src/services/keycloak.ts`**: require a **second-pass review** (peer / Bugbot / operator ack) before merge. Soft warn only — former rule `eliteew-bus-factor.mdc` was removed with agent-theater slim; the review expectation remains here.

---

## 5. Suggested control hooks (future; not required to invent now)

| Hook idea | Trigger | Effect |
|-----------|---------|--------|
| `fix-storm-gate` | ≥3 fix subjects same path prefix / 14d in session git log | warn `[FIX STORM GATE]` |
| `shotgun-chrome-gate` | diff ≥5 Desktop app files + portal/theme strings | warn / failClosed soft |
| `loc-budget-gate` | changed file crosses hard cap without `extract` in same commit | failClosed |

До появления hooks — **агент обязан** выполнить чеклист §4 вручную для ewa/desktop/agentic.

---

## 6. Program links

| Doc | Role |
|-----|------|
| [EWA-AGENTIC-KERNEL-REDESIGN.md](../product/ewa/EWA-AGENTIC-KERNEL-REDESIGN.md) | Core Logic redesign |
| [SHELL-LIFECYCLE-AND-CHROME-SSOT.md](../product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md) | UI SSOT redesign |
| [AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md) | Cause vs symptom |
| [ATOMIC-ROUTER-DECOMPOSITION-CANON.md](ATOMIC-ROUTER-DECOMPOSITION-CANON.md) | Backend split LOC targets |

## Failure / Edge-Case Matrix (governance itself)

| Axis | Behavior |
|------|----------|
| Offline-mode | Gates are local git/diff based; no cloud required |
| Dual-flag | Soft warn vs failClosed — default warn until operator enables failClosed |
| Permission | Does not override security/auth rules; process only |
| Regression | Manifesto changes → update this doc + point from INDEX; optional hooks-selftest later |
