# EliteEW documentation writing guide

Canon for authors, reviewers, and Cursor agents. **When** to update docs after code changes — **`.cursor/rules/documentation-maintenance.mdc`**. **How** to write and where to place files — this document.

Tree root: **`documentation/README.md`**, index: **`documentation/INDEX.md`**, role navigation: **`HANDBOOK-MAP.md`**.

---

## 0. Mandatory doc-gate (project standard)

This rule is mandatory for developers and Cursor agents.

After every nontrivial task (code, config, API, UX, deploy, process):

1. Assess `doc-impact`.
2. If behavior/contract changed — update the existing canonical file under `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/`.
3. If a new module/contract/ops process appeared — create a new canonical `.md` in the same section set.
4. If there is no `doc-impact` — state that explicitly in the task closeout.

If a living document became false, soft-retire it with **`bash scripts/eliteew/trash-move.sh`** → `trash/` (not `rm`, not the documentation archive tree (forbidden as living canon)).

Do not create living-product canon for soft-retired workspace trees (DEWA, EWGen, EWCO, EWPower, …) — only a retired note → `trash/` if the term is still needed in the glossary.

---

## 1. Where to create files

| Section | Contents |
|---------|----------|
| **`product/`** | UX, domain features, desktop, marketing, Assistant, user instructions (`handbook-user-docs/`, `handbook-kb-articles/`) |
| **`platform/`** | Podman-first container runtime, API infrastructure, auth, quality, operator runbooks; stack detail — **`platform/docker-re_doc/`** |
| **`api/`** | HTTP/OpenAPI, FE↔BE, integration contracts |
| **`database/`** | DB registries, data-integrity, migration process |
| **`reference/`** | Meta-documentation (this file, glossary, handbook map) |
| **`worklog/`** | **Not living canon.** Stub **`worklog/README.md`** only; journals/summaries → `trash/`. Do not write new monthly/session dumps there without an explicit operator request. |
| **`plans/`** | **Not living canon.** Operator-local process plans / roadmaps / remediation logs. **Gitignored** except `plans/README.md`. Do not use as SoT or agent DoD. |

**Living Docs-as-Code canon:** only `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/`.

**Forbidden as canon:** the EliteEW docs mid-alias (retired; use documentation/), the docker re_doc compose-tree root (retired; use platform/docker-re_doc/), the documentation legacy tree (forbidden as living canon), the documentation archive tree (forbidden as living canon), symlinks inside `documentation/`, duplicate code “mirrors”, root-repo product markdown.

**Process plans:** put under `documentation/plans/` (gitignored). Do not keep competing PLAN/ROADMAP files inside living `product/` / `platform/` / `api/`.

**Topology facts:** one SoT — `platform/PRODUCTION-TOPOLOGY-STATE.md` §Current. Other hubs may **link** to it; do not restate host/IP/stack tables as a second truth.

Module-local code docs (e.g. `shared/api/ewa_platform/docs/`) are OK for a **narrow API module**; product and operator canon live in `documentation/`.

---

## 1.1 Document type (short)

No separate Diátaxis hub (retired → `trash/`). In the living-canon header, one line is enough: tutorial / how-to / reference / explanation.

| Type | Question | Where |
|------|----------|-------|
| **Tutorial** | “How do I start from zero?” | `product/` / `platform/` how-to next to the domain |
| **How-to** | “How do I do X?” | ops runbook in `platform/docker-re_doc/` |
| **Reference** | “What is the exact contract?” | `api/`, `database/`, `PROJECT-GLOSSARY.md` |
| **Explanation** | “Why this way?” | domain canon in `product/` / `platform/` |

---

## 2. Paths and links

- **From monorepo root** (in `.cursor/rules/`, code comments, agent chat): always prefix **`documentation/`**, e.g. `documentation/platform/API-INFRASTRUCTURE.md`.
- **Inside `documentation/**/*.md`**: relative paths **without** the `documentation/` prefix — `platform/...`, `product/...`.
- **Do not** use obsolete prefixes: `docs_no_sort/`, the EliteEW docs mid-alias (retired; use documentation/), root docker re_doc compose-tree root (retired; use platform/docker-re_doc/) (ops canon — `platform/docker-re_doc/`), `trash_vr/`, `archive/` as living canon.
- Code links: full path from monorepo root (`shared/api/...`), with file anchors when useful.
- Stale material — **`bash scripts/eliteew/trash-move.sh`**, not `rm` and not the documentation archive tree (forbidden as living canon).

---

## 3. Language and audience

**Language (HARD):** living canon under `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/` that agents create or edit is **English**. Aligns with `eliteew-localization-engine.mdc` and [AGENT-LANGUAGE-BRIDGE.md](../platform/AGENT-LANGUAGE-BRIDGE.md) (bridge gate unhooked 2026-09-22; English-docs law remains). Do not author new Russian living-canon prose. UI Russian strings go through Gemma `ui-ru` / localization-engine / `locales/ru/**`, not this tree.

| Audience | Where | Tone |
|----------|-------|------|
| Developers / agents | `product/`, `platform/`, `api/`, `database/` | Technically precise, **English**; terms from **`PROJECT-GLOSSARY.md`** |
| Runtime/host operators (podman-first) | `platform/docker-re_doc/` | Commands, env, checklists; minimal theory; **English** |
| Desktop end users | `product/handbook-user-docs/` | Plain language, no internal stack/container names; **English** source (localized UX is separate) |
| Assistant RAG articles | `product/handbook-kb-articles/` | Aligned with UI; see **`PRODUCT-ASSISTANT-HANDBOOK.md`** |

**Homonym “Assistant”:** product UI ≠ the `documentation/` tree. In user-facing text do not confuse with “repository documentation”.

**EWA vs marketing AMKA:** contours are separate — see **`product/amka-seed-album/AMKA-CONTOURS.md`**, rule **`.cursor/rules/ewa-platform-default.mdc`**.

---

## 4. Document structure

1. **H1 title** — file topic (matches purpose; not “README” everywhere).
2. **Status** (when useful): `Canon` / `Draft` / `Archive` + date for reports.
3. **Short lead** — 1–3 sentences: why the file exists and its bounds.
4. **Body** — `##` sections; for long runbooks — tables, numbered lists, command blocks.
5. **Related documents** — end with link list (do not paste whole sections from other files).

Avoid: walls of text without headings; copy-pasting one paragraph into five files.

---

## 5. File names

- **UPPER-KEBAB** for canonical references: `DESKTOP-STATE-PERSISTENCE.md`, `KEYCLOAK-ELITEEW.md` (in `docker-re_doc/`).
- **README.md** — directory TOC only, not a long reference (details in a separate file).
- Dates in the name — for snapshots/handoffs: `EWA-COMPANION-SESSION-HANDOFF-2026-05-19.md` (one-off closeouts preferably go to `trash/` after absorption into living canon).
- One domain — one canonical file; retire stale versions with **`trash-move.sh`**, not an `-old.md` sibling next to canon.

---

## 6. When to create vs update

| Situation | Action |
|-----------|--------|
| New API/auth/migration/key UX contract | New or substantially updated `.md` + row in **`INDEX.md`** (+ **`HANDBOOK-MAP.md`** for a new entrypoint) |
| Feature behavior changed | Update existing topical canon |
| Internal refactor with no contract change | Explicit “no doc-impact” in task closeout (no monthly worklog) |
| Wording cosmetics | Only the touched file; leave INDEX alone |

**On conflict** with operator User Rules (“do not create markdown unless asked”): for **substantial** product/contract changes, **`documentation-maintenance.mdc`** wins. If the **current message** explicitly forbids `documentation/` — do not expand docs; state the blocker in the agent reply.

---

## 7. Worklog (retired)

Directory **`documentation/worklog/`** soft-retired **2026-07-18** → `trash/`. Stub: **`worklog/README.md`**.

- Chronology for agents: chat summary + `git log`; living canon — `{product,platform,api,database,reference}/`.
- Session-summary CLI (`scripts/eliteew/write-session-summary.py`) — **only** if the operator explicitly asks in the current message (`session-summary-files.mdc`).
- Do not restore monthly journals / bulk `session-summaries/` as product canon.

---

## 8. Indexes and navigation

For a **new** canonical file:

1. Row in **`documentation/INDEX.md`** (topic section).
2. When needed — **`reference/HANDBOOK-MAP.md`** (role → entrypoint).
3. For a new subdirectory — **`README.md`** in that directory (`product/`, `platform/`, …).

File counter: `./scripts/doc/list-md.sh` from the repo root.

Assistant music / image / vision canons live under **`product/ewa/`** — the handbook may point at them; do not remove map pointers even if a campaign does not edit them.

---

## 9. Cursor rules (two layers + hooks)

| Mechanism | Purpose |
|-----------|---------|
| **`documentation-maintenance.mdc`** | Mandatory doc-gate after every nontrivial task |
| **`documentation-writing.mdc`** | Style and structure when editing `documentation/**/*.md` |
| **`.cursor/hooks.json`** | Autocheck: block forbidden paths, content warnings, `INDEX.md` |

Scripts: **`.cursor/hooks/validate-documentation.py`**, **`.cursor/hooks/README.md`**. Workspace must be **trusted**.

Long canons live in **`documentation/`**; `.mdc` holds a short extract. Cursor SoT is monorepo-root `.cursor/` (EliteEW mid-alias `.cursor` mirror retired).

---

## 10. Prohibitions (short)

- Symlinks inside `documentation/`.
- New canon under the documentation archive tree (forbidden as living canon) or `legacy/` — use **`trash-move.sh`**.
- Secrets, passwords, tokens, personal data in markdown.
- In user instructions — internal stack names, Docker ports, operator disk paths unless necessary.
- Global rewrite of paths `documentation/platform/` → `platform/` inside `.cursor/` (breaks repo-root paths).
- Describing DEWA / EWGen / EWCO / stack666 / OpenVPN AS as a **living** workspace or prod path.

---

## 11. IDE indexing and git

| File | Purpose |
|------|---------|
| **`.gitignore`** | Do not commit secrets, `docker/data/`, heavy dumps; `no_index/` pattern retained (directory soft-retired 2026-08-13 → `trash/`, do not recreate) |
| **`.cursorignore`** | Hard block Agent Read/Grep/`@` (not the same as the index). Living canon `documentation/product/`, `documentation/platform/`, `documentation/api/`, `documentation/database/`, `documentation/reference/` and `site-templates/` sources remain via `@path` / Read. Last match wins; `keys/*` + `!keys/*.pub`, not `keys/` then `!`. |
| **`.cursorindexingignore`** | Semantic index only (`pack-cloud/mobile/`, EliteEW build artifacts); Read/`@path` remain. |

Root **`trash/`** — soft-retire via `scripts/eliteew/trash-move.sh` (gitignored contents).

---

## 12. Checklist before merge (docs)

- [ ] Task recorded `doc-impact`: docs updated/created or explicitly why not required.
- [ ] File in the correct section (`product` / `platform` / `api` / `database` / `reference`); not in `worklog/` (except stub).
- [ ] Link paths consistent (`documentation/` prefix only outside the `documentation/` tree).
- [ ] No duplicate canon; stale material via `trash-move.sh`.
- [ ] New file → `INDEX.md` (and `HANDBOOK-MAP.md` when needed).
- [ ] Do not restore retired `worklog/` journals without operator request.
- [ ] No “living DEWA/EWGen/EWCO/stack666” wording without retired → `trash/` note.
- [ ] Agent-authored living canon is **English**.
