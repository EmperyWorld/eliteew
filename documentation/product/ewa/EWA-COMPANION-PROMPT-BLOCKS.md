# EWA companion prompt blocks

Source contract review: 2026-10-11. Platform prose is resolved from a process-local PG cache and checked-in canon. Numeric/boolean settings are a separate [settings plane](EWA-PLATFORM-SETTINGS-DB.md). This reference does not report current production prompt bodies or certify all model output.

## Storage, bootstrap and resolution

- [Canon registry](../../../shared/api/ewa_platform/companion/prompt_blocks/canon.py): `PromptBlockSpec` (`block_key`, category, description, body), 45 keys across five categories.
- [Migration 034](../../../shared/api/ewa_platform/migrations/applied/034_ewa_companion_prompt_blocks.sql) and [PG helpers](../../../shared/api/ewa_platform/persistence_pg/prompt_blocks_asyncpg.py): `ewa_companion_prompt_block` keyed by text key and `ewa_companion_prompt_block_audit`.
- [Data-plane bootstrap](../../../shared/api/ewa_platform/bootstrap/data_plane.py) calls [bootstrap_prompt_blocks](../../../shared/api/ewa_platform/companion/prompt_blocks/service.py): ensure DDL, seed each canon key with `ON CONFLICT DO NOTHING`, load all stored bodies. It preserves existing operator bodies and metadata rather than automatically migrating their prose to new defaults.
- Runtime `get_prompt_block` trims the key and uses a loaded, non-whitespace DB body, otherwise nonempty canon, otherwise the caller default or empty string. It performs no PG request per lookup. An empty DB body means fallback, not disabling the instruction. Unknown keys can resolve from a loaded cache, but the admin catalog/update boundary exposes only canon keys.

An update transaction writes body/updater/time and an audit detail containing previous/new lengths and SHA-256 prefixes (16 hex characters), not full bodies. Seeding does not create equivalent update-audit records. After commit the service reloads **this process's** cache; there is no broadcast, periodic refresh or optimistic edit revision. Other API/worker caches can retain old bodies until explicitly reloaded/restarted. A reload error can occur after the DB update committed. Concurrent edits are last-writer updates at the body level; audit is not a compare-and-swap lock.

## Current key catalog

Counts and names below come from the canon registry; they are not runtime DB inventory.

- `emit` (4): `emit.actions_template`, `emit.memory`, `emit.memory_arlika`, `emit.structured_turn`.
- `persona` (20): `persona.agency_affirm`; `persona.parent.role`, `persona.mela.role`, `persona.zera.role`, `persona.kora.role`, `persona.tala.role`, `persona.feni.role`, `persona.feni.feminine_ru_grammar`; `persona.arlika.role`, `persona.arlika.system_prompt_tail`, `persona.arlika.character_style_snippet`, `persona.arlika.character_quarrel_snippet`, `persona.arlika.quarrel_role_prefix`, `persona.arlika.quarrel_strict_block`, `persona.arlika.quarrel_turn_block`, `persona.arlika.strict_output_block`; `persona.arlika_v2.role`, `persona.arlika_v2.system_prompt_tail`, `persona.arlika_v2.character_style_snippet`; `persona.global.companion_output_guard`.
- `sidecar` (4): `sidecar.tool_router`, `sidecar.intent_planner`, `sidecar.trust_classify`, `sidecar.arlika_wrath_classify`.
- `system` (4): `system.identity_preamble`, `system.action_fulfillment_rules`, `system.action_fulfillment_rules_quarrel`, `system.tool_catalog_capability_rule`.
- `workflow` (13): `workflow.anchor_compose`, `workflow.chat_condense`, `workflow.doceditor_translate`, `workflow.evolution_summary`; `workflow.reflect_week.task`, `workflow.reflect_week.output_rules_ru`, `workflow.reflect_week.output_rules_en`; `workflow.social_post.identity`, `workflow.social_post.format_rules`, `workflow.social_post.lang_ru`, `workflow.social_post.lang_en`, `workflow.social_post.length_short`, `workflow.social_post.length_long`.

`Server_tool_catalog` is computed by [tool_catalog_md](../../../shared/api/ewa_platform/companion/prompt_blocks/tool_catalog_md.py) from `export_tool_catalog`, with a default maximum of 80 entries and 180-character one-line summaries. It is not an editable DB block. A registry entry establishes a registered capability, not successful execution or every runtime gate being open. Channel-specific social guidance remains in source. The separate [desktop LLM prompt directory](../../../shared/api/ewa_platform/llm/prompts/README.md) is a future template location, not the current companion block loader.

## Substitutions and legacy role settings

[Action instructions](../../../shared/api/ewa_platform/companion/actions/allowlist.py) replace literal `{components}` with the current app allowlist and append source-generated action rules. Preserve that token when editing `emit.actions_template`: the PUT boundary does not validate its presence. Router/planner replace `{lang}` (or their known English fallback sentence); [trust classifier](../../../shared/api/ewa_platform/companion/sidecar/trust_classify.py) formats `{score}`. Arbitrary template syntax is not a shared supported template language, and each consumer's fallback/error behavior is separate.

[Persona config](../../../shared/api/ewa_platform/companion/config.py) retains `EWA_PERSONA_*` string resolution: specific seed, parent fallback, canonical value. A nonempty resolved block differing from that consumer's canonical constant wins over legacy persona settings; an unchanged canonical block permits the legacy override. This is not simply “every seeded DB body always wins.” Hostile Arlika can reject a weak role override, and agency/output tails are composed separately. [Seed reference](EWA-COMPANION-SEED-PERSONA-MATRIX.md) covers numeric defaults and initializable seeds.

The source and tests record a historical 2026-08-09 operator-overlay synchronization for six bodies (`emit.actions_template`, `emit.memory`, `persona.global.companion_output_guard`, `persona.kora.role`, `workflow.anchor_compose`, `workflow.chat_condense`). This review verified those checked-in bodies/tests, not their present live-DB equality. Bootstrap deliberately preserves operator edits.

## Admin HTTP contract

[Router](../../../shared/api/ewa_platform/gateways/routers/companion_admin.py), [models](../../../shared/api/ewa_platform/schemas/pydantic/companion_admin.py). Prefix `/api/v1/ewa/admin/companion`. All three operations require OAuth identity with role `admin` or `emperyworld_admin`; another role → 403 `Administrator privileges required`. Shared auth governs missing/invalid token behavior.

Unlike the bootstrap-oriented settings endpoints, prompt routes call the companion-admin feature gate: disabled → 503 `ewa_companion_admin_disabled`. PUT also needs its write gate: disabled → 503 `ewa_companion_admin_write_disabled`.

| Method/path | Input and successful response | Additional boundary |
|---|---|---|
| `GET /prompt-blocks` | No body; `{blocks: [...], schema_version: "ewa_companion_prompt_blocks_v1"}`. Each block: key/category/description/body, nullable updated time/updater, `source: db|canon`. | Returns all canon keys sorted by key, merged with DB rows. With no pool returns canon; existing blank DB row is shown as blank/source db, even though runtime falls back to canon. Extra DB-only keys are omitted. |
| `PUT /prompt-blocks/{block_key}` | Body `{"body_text":"..."}`; omitted field defaults empty. Returns one block with source db. No field-level length/template/placeholder constraints or expected revision. | Unknown canon key → 404 `prompt_block_unknown`; missing pool → structured EWA 503. Service seeds a missing canon row then retries update; still absent → 404 `prompt_block_not_found`. Type errors → request validation 422. |
| `GET /prompt-blocks/audit` | Optional string `block_key`, integer `limit` default 50, storage clamp 1–200. Returns `{entries: [...], schema_version: "ewa_companion_prompt_block_audit_v1"}`; entry has id/key/action/nullable actor/detail/nullable created time. | Requires pool; no separate canon-key validation for the audit filter. Invalid integer → 422. Current JSONB decoding can fail on nonempty audit results: [DOC-CODE-020](../../../docs/CODE_ISSUES.md#doc-code-020--prompt-block-audit-cannot-decode-default-codec-jsonb-detail). |

Bodies are plaintext in PG and exposed to authorized admin reads; prompts are not a secret store. The updater is `username or email`, not a guaranteed token-sub field. Runtime fallback and the catalog's displayed DB value can differ, so GET alone is not an effective composed-prompt preview.

## UI and verification

[Prompts tab](../../../shared/web/frontend/src/features/ewa/admin/EwaCompanionPromptsTab.tsx) filters categories, edits one selected body, calls PUT and invalidates its prompt-block query after success. Save UI is write-gated; server authorization remains authoritative. It does not synchronize other processes' caches or atomically update related blocks.

Existing `test_ewa_companion_prompt_blocks.py` checks all canon bodies are nonempty, selected historical bodies/placeholders, fallback, computed tool catalog and source call sites. The bounded prompt/proactive suite recorded six prompt tests passing; it did not test PG reload propagation or live model adherence. A synthetic audit helper probe confirmed the string-JSONB failure without a database connection.
