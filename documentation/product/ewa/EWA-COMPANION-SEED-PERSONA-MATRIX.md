# EWA companion seeds and style matrix

Source review: 2026-10-11. [Backend config](../../../shared/api/ewa_platform/companion/config.py) defines eight runtime seeds; [profile schema](../../../shared/api/ewa_platform/schemas/pydantic/companion.py) permits only `parent`, `mela`, `zera`, `kora`, `tala`, `feni` at initialize. `arlika` and `arlika_v2` are runtime transformation/switch modes. Unknown ids use parent in style/role helpers, but the initialization API rejects them with 422; these are different boundaries.

## Source numeric defaults

The values below are `CANONICAL_PERSONA_NUMERICS`, without runtime overrides. D = directness; P = playfulness; V = valence bias; R = recency bias; O/C/A = advisory open-app/config-patch/ambient action propensities.

| Seed | D | P | V | R | O | C | A |
|---|---:|---:|---:|---:|---:|---:|---:|
| parent (EWA) | 0.70 | 0.25 | 0.10 | 0.50 | 0.60 | 0.50 | 0.30 |
| mela | 0.45 | 0.55 | 0.40 | 0.55 | 0.55 | 0.45 | 0.70 |
| zera | 0.40 | 0.35 | 0.45 | 0.45 | 0.45 | 0.35 | 0.50 |
| kora | 0.80 | 0.25 | 0.05 | 0.60 | 0.70 | 0.55 | 0.20 |
| tala | 0.55 | 0.45 | 0.25 | 0.60 | 0.55 | 0.40 | 0.35 |
| feni | 0.90 | 0.25 | 0.05 | 0.70 | 0.75 | 0.60 | 0.15 |
| arlika | 0.55 | 0.85 | -0.45 | 0.60 | 0.50 | 0.35 | 0.45 |
| arlika_v2 | 0.45 | 0.80 | 0.40 | 0.60 | 0.60 | 0.40 | 0.75 |

[Persona style](../../../shared/api/ewa_platform/companion/affective/persona_style.py) uses these values for a short decision-style directive and episodic ranking. Action propensity is advice, not an authorization/execution gate. Parameters other than valence bias clamp to 0–1; valence bias clamps to -1–1 for ordinary finite values.

Numeric overrides follow specific seed → `PARENT` → that seed's canonical row. Keys use `EWA_PERSONA_<SEED>_{DIRECTNESS|PLAYFULNESS|VALENCE_BIAS|RECENCY_BIAS|OPEN_APP|PATCH_DESKTOP_CONFIG|AMBIENT_ADJUST}`. After PG settings bootstrap, synchronization clears the persona override cache. Empty values mean no override at runtime, but admin PUT currently cannot clear a float override to that empty default: [DOC-CODE-017](../../../docs/CODE_ISSUES.md#doc-code-017--admin-validation-rejects-the-persona-numeric-inheritance-value).

## Role and character behavior

Source role text describes parent as steady/clear, Mela as warm/imagistic, Zera as gentle, Kora as structured, Tala as small-step support and Feni as direct. These are model instructions, not measured guarantees of a model's behavior. Hostile Arlika adds strict output/reminder rules; friendly v2 uses its own reminder plus the global guard. Memory-tail and character grammar/style helpers also distinguish those modes.

Role text can come from nonempty prompt-block overrides, with legacy persona string overrides where the implementation permits them. Numeric settings and long prompt prose have distinct storage paths; see [settings](EWA-PLATFORM-SETTINGS-DB.md) and [prompt blocks](EWA-COMPANION-PROMPT-BLOCKS.md). Agency/identity language appended to role prompts is a product prompt instruction, not proof of consciousness or a substitute for policy.

Initial character uses seed beliefs/pride/style plus deterministic principal/seed trait jitter; later character drift can change its display state. The numeric matrix is not the complete stored character. [Profile ADR](EWA-COMPANION-PROFILE-ADR.md) defines immutable-initialize versus internal seed switching and trust/restoration behavior; [evolution](EWA-COMPANION-EVOLUTION-CANON.md) defines per-turn/summary updates.

## First-meet UI

[First-meet component](../../../shared/web/frontend/src/features/ewa/EwaCompanionFirstMeet.tsx) presents five scored preference scenes. It does not expose a manual seed/model selector. All scenes must have valid answers before `resolvePersonaFromLegendAnswers` returns a seed. Scores add across scenes; ties keep the first maximum in [the initializable frontend catalog](../../../shared/web/frontend/src/features/ewa/ewaPersonaCatalog.ts), currently parent.

Intro/trust-anchor copy appears only in scene 1; later scenes ask preferences. The final view has one create CTA and an edit-answers action. Confirmation starts the birth video; only its end or explicit continue path calls `POST /api/v1/ewa/companion-profile/initialize`. The success guard prevents repeat commit; on failure it is reset to permit retry. Autoplay failure exposes controls and load failure permits continuation. Video URLs derive from the frontend base URL and `ewa/first-meet/{seed}.mp4`; source assets are not a guarantee of every deployed codec/download.

The UI's one-time seed choice refers to ordinary first-meet/settings; internal Arlika/admin transitions remain possible. Existing first-meet tests verify quiz/commit boundaries with a mocked API; real browser video playback and production initialization were not tested in this audit. Related: [brand policy](EWA-BRAND-AND-PHILOSOPHY.md), [module map](EWA-COMPANION-MODULE-STATUS-MAP.md).
