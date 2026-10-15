# Agent Tauri Security Workflow

## Status

**Process canon remains**, but the **agent loop owners were unhooked** on 2026-09-22
(`chore(cursor): drop language-bridge and Tauri security from the agent loop`):
rule tauri-security-boundary rule *[intentionally unhooked]*, skill `SKILL.md`, slash command, and
`tauri-security-reviewer` agent were removed so they stop fighting operator workflow.

Use this document + the finding matrix as **manual / on-demand** defensive guidance for
Tauri trust-boundary work. Do **not** recreate the failClosed skill/rule without an
explicit operator task.

This workflow operationalizes findings from the defensive assessment
“Tauri 2 defensive security assessment”. It does **not** claim that the product
findings are already remediated. Product status changes only when the relevant
cause-layer code, negative tests, migration/release evidence, and documentation
have landed.

Owners (current):

- Process canon: this file
- Finding matrix: `.cursor/skills/eliteew-tauri-security/references/security-matrix.md`
- Rule / Skill / `/eliteew-tauri-security`: **removed from agent loop** (2026-09-22)
- Hook: `.cursor/hooks/tauri-security-gate.py`
- Deterministic policy: `.cursor/hooks/tauri_security_policy.py`
- Optional read-only reviewer: tauri-security-reviewer agent *[intentionally unhooked]*
- State: `.cursor/hooks/state/session-phase-gate-<conversation-hash>.json`

## Goal

An agent cannot close, commit, or publish a scoped Tauri change merely because it
compiles or passes a happy-path test. The change must demonstrate that an
attacker-controlled WebView cannot convert frontend control into native
privilege, secret disclosure, arbitrary egress/filesystem access, update trust
replacement, or unbounded resource consumption.

The domain verdict is:

- **TAURI SECURITY VERIFIED** — fresh content fingerprint, deterministic checks
  clean, F-01 through F-13 covered, required evidence families recorded, and no
  finding/action/residual risk remains.
- **TAURI SECURITY BLOCKED** — definitive external blocker; the task is not Done
  and commit/publish remains denied.

`FAILED` is not stored as a terminal state. Fix the cause and repeat.

## Threat model

Assume the attacker controls:

- product or remote WebView content;
- IPC parameters, URLs, file/archive inputs, deep links, and process env;
- unsigned or replayed OTA metadata;
- a previously issued package or activation attempt.

Assume the following are not compromised:

- the Rust binary after a verified installation;
- OS keyring, process isolation, and native permission boundary within the
  explicitly declared platform threat model;
- server-side signing private keys.

Full host/root compromise is outside this specific model, but the implementation
must not unnecessarily widen the blast radius through shared keys, plaintext
storage, shell construction, or cross-product trust reuse.

## Scoped paths

The gate derives scope from session edits, worktree content changes relative to
the session baseline, and local commits. It covers:

- `pack-organization/connection-agent/**`;
- desktop-client API routers, services, schemas, and tests;
- shared Admin platform-ops issuance UI/contracts;
- shared API config/auth paths that can alter desktop-client trust;
- `scripts/eliteew/desktop-client-*.sh`.

Build artifacts, generated output directories, and dependency trees are excluded,
except the tracked shared desktop OpenAPI contract used by the Admin issue flow.
The complete scope implementation lives in
`.cursor/hooks/tauri_security_policy.py`; rules and docs must not silently diverge
from that executable list.

## Security finding contract

Every verdict covers all audit IDs:

- **F-01** — custom IPC command inventory and least-privilege capabilities;
- **F-02** — retail/system-WireGuard privilege and shell boundary;
- **F-03** — per-device capsule recipient identity and enrollment proof;
- **F-04** — Rust-only, atomic secret lifecycle;
- **F-05** — AI credential isolation and origin binding;
- **F-06** — typed native egress and SSRF/redirect/body controls;
- **F-07** — immutable compile-time retail security posture;
- **F-08** — caller authorization, Rust-owned tickets, confirmation, replay;
- **F-09** — exact CSP and exfiltration denial;
- **F-10** — navigation, opener, custom protocol, and deep-link boundary;
- **F-11** — opaque filesystem grants and safe archive extraction;
- **F-12** — signed metadata, key-role/product separation, package trust;
- **F-13** — streaming, quotas, cancellation, and concurrency limits.

The executable review questions and proof expectations are in the skill matrix.
An ID may be `N/A` only when path-level evidence proves that the changed behavior
cannot reach that boundary. Existing vulnerable behavior or “unchanged code” is
not evidence of safety when a changed hotspot still contains the finding.

## Lifecycle

```text
sessionStart
  → capture HEAD + hashes of pre-existing dirty paths
  → scoped write
      → preToolUse denies obvious newly proposed regressions
      → afterFileEdit records scope and invalidates old Tauri verdict
  → security-relevant shell checks are recorded
  → stop / commit / publish
      → derive complete scoped paths
      → run deterministic F-ID checks
      → no fresh verdict: [TAURI SECURITY GATE — BLOCKER]
      → execute eliteew-tauri-security
      → fix findings + negative tests + same-phase docs
      → record VERIFIED or honest BLOCKED with fingerprint
  → commit / publish only on explicit operator request
    (verified-proposal-protocol; Tauri VERIFIED required for scoped commit/publish)
```

Any later scoped content change invalidates the domain verdict. The fingerprint
also binds the executable policy helper, gate, hook registration, and boundary
rule, so changing enforcement invalidates a prior verdict even when product
paths are unchanged. A local commit does not invalidate it when path content is
unchanged, but human approval for commit still applies.

## Hook behavior

`tauri-security-gate.py` is registered for:

- `preToolUse` write-style tools, `failClosed: true`: deny obvious additions such
  as broad product permissions, runtime trust overrides, retail WG shell/elevation,
  generic command URLs, wildcard CSP, bulk archive unpack, and unbounded buffering;
- `postToolUse` Shell, fail-open tracking: record only successful evidence
  families and SHA-256 command digests for relevant Rust/Vitest/pytest/Biome/
  shell runs, never raw command text or arguments;
- `afterFileEdit`, fail-open tracking: record scope, invalidate stale verdict
  and prior run evidence, and inject the phase workflow once;
- `beforeShellExecution`, `failClosed: true`: deny `git commit` and desktop-client
  publish/release commands until the domain verdict is freshly VERIFIED;
- `stop`, `failClosed: true`, `loop_limit: null`: return a Cursor-native
  follow-up until VERIFIED or honest BLOCKED is fresh;
- CLI `inspect`, `scan`, and `record`: used by the skill and selftests.

The deterministic scanner intentionally checks only changed scoped paths. It is
not a claim that untouched historical debt is safe. When a security hotspot is
changed, its relevant current invariant must be made safe before that phase can
close; agents must not add a baseline exemption to preserve vulnerable behavior.

## Closeout after Tauri VERIFIED

The Tauri verdict is a **domain predicate** for trust-boundary paths, not a
general completion theater.

For sessions with scoped paths:

1. Record `TAURI SECURITY VERIFIED` or honest `BLOCKED`.
2. Commit / publish remain denied by the Tauri shell gate until VERIFIED is fresh.
3. Actual `git commit` still requires an **explicit operator request**
   ([AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](AGENT-VERIFIED-PROPOSAL-PROTOCOL.md)).

General hard-acceptance (`eliteew-hard-acceptance`) is **retired** — do not wait
for a second whole-diff VERIFIED theater after Tauri.

## Report and evidence

The recorder requires:

- every scoped path;
- summary and cause-layer statement;
- F-01 through F-13 `PASS`/justified `N/A` coverage;
- explicit offline, conflict, permission, and regression answers;
- exact commands/results;
- empty findings, required actions, blockers, and residual risks for VERIFIED.

Required command families are derived from changed production paths:

- Rust/config/capability: both Cargo format/check/clippy and filtered test
  evidence;
- desktop TypeScript: both a production build and narrow Vitest evidence;
- API Python: narrow pytest/stack0-wrapper evidence;
- Admin frontend: Biome/compiler check plus narrow Vitest evidence;
- release shell: `bash -n` or `shellcheck`;
- every production scope: deterministic security scan.

Test-only changes still require the matching filtered Rust/Vitest/pytest run;
they do not require production static-scan evidence by themselves.

The hook state stores evidence families, command digests, and content
fingerprints—not raw commands or secret material. Reports may not contain
credentials, private keys, raw env values, PII, or production secret payloads.

## Failure and edge cases

### Offline

The gate and scanner are local and have no network dependency. Product work must
still prove the applicable offline request/import/start/update behavior. An
external canary may justify BLOCKED only when it is indispensable to the claim;
missing local implementation/tests are FAILED work.

### Conflicting states

The current scoped path set and content fingerprint win over stored verdicts.
Default scope is **session edits** (hook `acceptance_touched` ∪ dirty-vs-baseline),
filtered to Tauri trust-boundary paths — same anti-lie helper as Gemma
(`gemma_session_paths`). Opt into `session_start_head..HEAD` only with
`ELITEEW_GEMMA_INCLUDE_COMMITS=1` (fat fallback if path count exceeds the limit).
Retail and ops features, product/channel identity, duplicate issuance, stale
request/token, and profile/entitlement conflicts must have explicit fail-closed
behavior. Silent precedence is not accepted.

### Permission boundary

The hook writes only local state and scans repository text. It does not read
secret paths, elevate, deploy, publish, or alter production. Product/remote
WebViews remain default-deny; Admin issue paths retain RBAC/constant-time ops
authorization; OS privilege uses the product's native prompt/helper design.

### False-positive or policy defect

Do not bypass or weaken the hook. Capture the exact finding and changed path,
prove why the deterministic rule is incorrect against the threat contract, fix
the policy and its selftest in the same phase, then rerun Tauri security
acceptance. A policy defect is not permission to ship the product change.

### Missing/corrupt state

Session provenance cannot support VERIFIED. The recorder may store only an honest
BLOCKED recovery verdict, and commit/publish remains denied.

## Independent review

`tauri-security-reviewer` is an optional read-only adversarial subagent. Use it
only when the operator permits subagents. If the operator prohibits them, the
implementing agent performs and records a fresh manual second pass; the security
bar is unchanged.

## Verification

Primary governance regression:

```bash
bash .cursor/hooks/hooks-selftest.sh
```

The selftest must cover:

- pre-write denial of a known security regression;
- stop follow-up without a verdict;
- hashed run evidence with failed/stale runs rejected;
- incomplete/secret report rejection;
- F-01 through F-13 complete VERIFIED recording;
- post-verdict scoped edit invalidation;
- commit/publish denial without fresh VERIFIED;
- missing-state BLOCKED recovery without false VERIFIED;
- Cursor SoT: monorepo-root `.cursor/` only (EliteEW mid-alias `.cursor` tree retired).

After root Cursor asset changes, keep monorepo-root `.cursor/` as SoT (no EliteEW mirror); rerun the
selftest, and Reload Window if Cursor does not show the new hook/command/agent.
