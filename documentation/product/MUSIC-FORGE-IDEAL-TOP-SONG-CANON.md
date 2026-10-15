# MusicForge — Ideal TOP Song Canon

**Status:** living quality canon (2026-07-18).
**Owner product hub:** [MUSIC-FORGE-APP.md](MUSIC-FORGE-APP.md).
**Process plan (gaps → waves):** `documentation/plans/product/MUSIC-FORGE-IMPROVEMENT-PLAN.md` *[operator-local process plan; gitignored — not living canon]* — this Ideal TOP file wins on quality contracts.
**Scope:** what an operator-approved **TOP** AceStep song looks like at the Comfy boundary — caption, lyrics, model, sampler. MusicForge default lane must converge to this shape.

This is **not** a UI guide. It is the machine contract for “song that sounds like studio TOP”, derived from operator-liked AceStepSFT exports (2026-06-08 era) and locked as Forge target.

---

## Why this exists

Weak Forge tracks were rendered on **XL Base / Turbo** (`Musicv2_base.json` / euler cfg≈2) with short captions and section-case mismatch. Operator TOP tracks were **AceStepSFT** (`ace_sft_new.json`) with dense section captions, full lyric arcs, and `jkass_quality` / cfg **7**.

| Axis | TOP (canon) | Anti-pattern (forbidden as default) |
| --- | --- | --- |
| Graph | AceStepSFT (`205`/`203`/`202`/`207`) | Base TextEncodeAceStep + KSampler euler cfg 2 |
| Model | `acestep_v1.5_xl_sft_bf16.safetensors` | `…_xl_base_bf16` / Turbo as default for house/DnB/pop |
| Caption | Dense English production arc, **Title Case** `[Intro]`…`[Outro]` | Short prose; lowercase `[intro]` while lyrics use `[Intro]` |
| Lyrics | Full song + `(Arrangement:)` / `(Voice:)` per section | Tiny Verse/Chorus only; gender fight in Voice vs tags |
| Duration | **220–240 s** (SFT max clamp 240) | Short 90 s “test cuts” as quality judgment |
| Sampler | `jkass_quality` + `sgm_uniform`, **cfg 7**, steps **50** | euler/simple cfg 2 |
| LM | temp ≈ **0.82–0.85**, lm_cfg ≈ **2.1–2.2**, top_p ≈ **0.9–0.91** | Over-sterile temp 0.8 / cfg 1.9 without SFT graph |

---

## Stack (hard)

```text
Workflow file:  host/comfyui/ace_sft_new.json
UGS flag:       ugs_workflow=v4  (ace_workflow=v4)
Type key:       music_generator_forge_audio  (Forge dedicated; not Evolution xl_base)
MusicForge lane: SFT XL  (algorithm.select_music_forge_model_lane default)
```

| Node | Class | Role |
| --- | --- | --- |
| 205 | `AceStepSFTModelLoader` | `acestep_v1.5_xl_sft_bf16` + qwen 0.6B/4B + `ace_1.5_vae` |
| 203 | `AceStepSFTTextEncode` | `caption` + `lyrics` + LM knobs |
| 202 | `AceStepSFTGenerate` | diffusion: steps/cfg/sampler/APG |
| 207 | `SaveAudioMP3` | output |

Opt-in only (not TOP default): BASE (`base xl`), TURBO (explicit `turbo` / `xl turbo`). Genre words alone must **not** force Turbo.

---

## Caption contract (node 203 `caption`)

### Shape

1. Optional prefix `Style: …`
2. Early tokens: **`{BPM} BPM`**, **one** **`{male|female|duet} vocal`**, genre name
3. Full arc with **Title Case** brackets (must match lyrics headers):

```text
[Intro] … [Verse] … [Pre-Chorus] … [Chorus] …
[Verse 2] … [Pre-Chorus 2] … [Chorus 2] …
[Bridge] … [Chorus 3] … [Outro] …
```

4. Each section: **≤2 short cues** in hierarchy — (1) kick/tempo, (2) bass, (3) lead vocal, (4) optional one texture. **Do not** stack DAW jargon (`sidechain` + `acid` + `granular` + `sub-bass` + `pluck`) in one caption — AceStep collapses that into muddy spectral mush (audit 2026-09-03).
5. Length: sparse, typically **400–720** chars (hard slim cap **720** via `slim_ace_style_caption`).

### Title Case invariant (hard)

| Wrong | Right |
| --- | --- |
| `[intro] pads…` | `[Intro] pads…` |
| `[verse] bass…` | `[Verse] bass…` |
| `[pre-chorus] …` | `[Pre-Chorus] …` |

Lyrics use `[Intro]` / `[Verse 1]` / `[Chorus]`. Caption section tags **must** use the same Title Case family. Lowercase caption + Title Case lyrics is a quality defect (ACE section alignment / operator TOP contract).

Implementation: `capitalize_ace_section_tags_in_style` after tag finalize **and** again on the final `caption` string assigned to node 203 (SFT path must not re-lower).

### Minimal skeleton (when LLM omits arc)

```text
Style: {BPM} BPM, {vocal} vocal, {genre}.
[Intro] …, [Verse] …, [Pre-Chorus] …, [Chorus] …,
[Verse 2] …, [Pre-Chorus 2] …, [Chorus 2] …,
[Bridge] …, [Chorus 3] …, [Outro] …
```

### Reference TOP caption (pop / Luna-style — operator gold)

Compressed pattern from liked export `20260608_070920_*` / replay history:

```text
{BPM} BPM, female vocal, Russian dream / indie electro-pop (Luna style), with intimate emotional delivery,
[Intro] dreamy synth pad, light reverb, slow arpeggio,
[Verse] pulsing analog bassline, distant delay, clean guitar texture, sparse drums,
[Pre-Chorus] rising synth sweep, subtle kick drum entry, filtered pads swell,
[Chorus] wide emotional pads, soft driving drums, layered vocal harmonies, stereo width boost,
[Verse 2] prominent bassline, gentle shaker percussion, subtle pad movement,
[Pre-Chorus 2] rising synth texture, increased vocal urgency, filtered hi-hat introduction,
[Chorus 2] stronger pad sustain, emotive vocal layering, fuller soft drums, dynamic lift,
[Bridge] stripped down, soft ambient pads, close mic vocal focus, minimal instrumentation,
[Chorus 3] full instrumentation, powerful vocal delivery, driving soft drums, saturated synth pads,
[Outro] slow synth decay, long reverb tail, filtered fade out, breathy vocal whisper,
supersaw lead in chorus, sidechain compression on kick, modern production with human touch
```

Second gold (club pop, 66 BPM replay): same arc density; `Style: Pop. {BPM} BPM, female vocal, …` then section list through `[Outro]`.

---

## Lyrics contract (node 203 `lyrics`)

### Structure (full song)

Required section set (order flexible but complete):

`Intro → Verse 1 → Pre-Chorus → Chorus → Verse 2 → Pre-Chorus → Chorus → Bridge → Chorus → Outro`

### Per-section enrich (hard for TOP)

```text
[Intro]
(Arrangement: <concrete English production>, {BPM} BPM feel)
(Voice: <gender>, <delivery>)

[Verse 1]
(Arrangement: …, {BPM} BPM)
(Voice: …)
<sung RU/EN lines — real words only>
```

Rules:

- Sung lines: lexical words only; no standalone ooh/aah/mm.
- Chorus repeats the hook phrase.
- `(Voice:)` gender **must** match caption vocal token. MusicForge post-enrich **`lock_voice_enrich_lines_to_vocal`** rewrites opposite-gender tokens (soloist templates must not inject `male, focused female`).
- Arrangement BPM in enrich lines **must** match numeric `bpm` field (coerce before Comfy).
- Prefer ≥16 sung lines for 220–240 s.
- **Sung vocabulary (2026-08-17):** do not sing production words (`ритм`, `пульс`, `бит`, `такт`, BPM, rhythm, pulse, beat, groove). `style_hint` is arrangement-only. Gate codes `meta_music_jargon` / `empty_pop_cliche` / `weak_cliche_fill` / `abstract_noun_chant` hard-fail + one LLM retry. Blueprint should carry concrete `scene_beats` for verse imagery. Do **not** rewrite ритм→пульс.

### Reference TOP lyrics header style

```text
[Intro]
(Arrangement: Synth pads and steady kick drum, 66 BPM feel)
(Voice: Soft, breathy)

[Verse 1]
(Arrangement: Driving bassline enters, light hi-hats, 66 BPM)
Я знаю, что пора мне просто лечь и молчать,
…
```

---

## Numeric recipe (node 203 + 202)

| Field | TOP default | Notes |
| --- | --- | --- |
| `duration` | **220–240** | Forge create max 240; SFT clamp 240. **Default render:** one Comfy pass for full duration. Multi-chunk long-form stitch is **opt-in** (`ACE_V4_SFT_LONG_FORM_ENABLED=1`) — default off (2026-09-03; 4×60s regenerations muddied TOP mixes). |
| `bpm` | from caption / genre heuristic | DnB ~174, house ~124, pop ballad ~70–100, mid-pop ~110–120 |
| `keyscale` | genre map | e.g. pop `A minor`, house `F minor`, DnB `D minor` |
| `language` | `ru` / `en` | from idea |
| `lm_temperature` | **0.85** (band 0.82–0.85) | |
| `lm_cfg_scale` | **2.1** (band 2.1–2.2) | |
| `lm_top_p` | **0.91** | |
| `lm_top_k` | 0 | |
| `lm_min_p` | 0.0 | |
| `generate_audio_codes` | true | |
| `steps` | **50** | |
| `cfg` (generate) | **7.0** | |
| `sampler_name` | `jkass_quality` | |
| `scheduler` | `sgm_uniform` | |
| `shift` | ~2.5–3.5 | seed-jittered on v4 helper OK |
| `guidance_mode` | `apg` | graph default |
| LoRA | **off** on default TOP | Luna LoRA = separate `v4_luna` opt-in, not Forge default |

`lm_negative_prompt`: keep extreme wail/choir-drown out; do **not** sterilize natural sung expression.

---

## BPM / vocal / section sync (hard)

1. First BPM token in caption ≡ `bpm` field (`align_first_bpm_in_tags_to_value`).
2. Arrangement lines in lyrics coerced to same BPM.
3. Caption section list should cover **Chorus 3** and **Outro** when lyrics have them (avoid limp endings).
4. Vocal: intent → caption → genre default → blueprint → corpus; then `align_style_caption_to_vocal` + tag vocal token normalize.

---

## MusicForge code map

| Concern | Path |
| --- | --- |
| Lane default SFT XL | `shared/api/services/music_forge/algorithm/` → `select_music_forge_model_lane` |
| Caption / LM / sampler defaults | `build_style_capsule`, `build_audio_input_data` |
| Lyrics enrich DnB/house/lofi | `enrich_music_forge_lyrics_for_ace` |
| Title Case on tags | `capitalize_ace_section_tags_in_style` in pipeline + SFT caption finalize |
| Comfy fill | `shared/api/services/studio_comfy_workflows.py` → `build_ace_music_v4_sft_workflow` / label `v4` |
| Product hub | [MUSIC-FORGE-APP.md](MUSIC-FORGE-APP.md) |
| Live operator smoke | `shared/api/scripts/music_forge_live_random_song.py` (`MUSIC_FORGE_LIVE=1`) |

Version marker: `music_forge_mvp_v2_xl_sft_q4_1` (or later) must keep this canon.

---

## Mobile / web surfaces

| Surface | Uses this canon? |
| --- | --- |
| Desktop **MusicForge** (`/api/v1/music-forge/*`) | **Yes** — backend-owned |
| Mobile UGS Songs (`/api/v1/music-forge/*` create+poll) | **Yes** — same API; SFT TOP lane server-owned (`MusicForgeMobileSupport.kt`) |

---

## Quality SLO (operator)

Automated acoustic scoring is **out of scope**. Product gate remains:

1. Machine contract above (caption/lyrics/SFT knobs) — pytest `test_music_forge_algorithm.py`.
2. **Human listen** of at least one completed run before calling a lane/default change «production-ready» (see MUSIC-FORGE-APP Operator Smoke).
3. Optional live script: `music_forge_live_random_song.py` with `MUSIC_FORGE_LIVE=1` (not CI default).

Watch metrics (ops): `music_forge_metric_total` fail/cancel rates; Admin overview fail-by-stage; feedback like/dislike — not a substitute for listen.

---

## Acceptance checklist (before calling a run “TOP-shaped”)

- [x] `ugs_workflow=v4`, workflow `ace_sft_new.json`, model `…_xl_sft_bf16` (default lane lock)
- [x] Caption has Title Case `[Intro]`…`[Outro]` (machine: `capitalize_ace_section_tags_in_style` + algorithm tests)
- [x] Lyrics have matching Title Case sections + `(Arrangement:)` / `(Voice:)` (enrich path)
- [x] Caption vocal gender ≡ Voice gender ≡ `vocal` field (align helpers)
- [x] BPM aligned across caption / field / arrangement lines (same integer; MusicForge enrich must not soloist-clamp away from capsule)
- [x] duration default ≥ 220 (prefer 220–240) — product/schema/FE 2026-08-16
- [x] Generate: steps 50, cfg 7, `jkass_quality`, `sgm_uniform` (SFT lane defaults)
- [x] LM: temp≈0.85, cfg≈2.1, top_p≈0.91 (SFT defaults)
- [x] No Base/Turbo unless operator explicitly opted in

---

## Regression

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_music_forge_algorithm.py -q --tb=short
```

Live (command-center → prod API hotpatch or deploy; gate `MUSIC_FORGE_LIVE=1`):

```bash
podman exec -e MUSIC_FORGE_LIVE=1 -e PYTHONPATH=/app stack0-eliteew-api-prod-baked \
  python /app/api/scripts/music_forge_live_random_song.py \
  --style "modern emotional pop" --duration 220
```

Dump Comfy boundary: rebuild via `build_ace_music_v4_sft_workflow(input_data)` and assert node 203 `caption` contains `[Intro]` not `[intro]`.
