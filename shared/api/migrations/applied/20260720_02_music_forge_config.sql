-- MusicForge Phase 2: DB-backed config revisions (lanes, styles, prompts, product settings).
BEGIN;

CREATE TABLE IF NOT EXISTS music_forge_config_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'retired')),
    notes TEXT,
    activated_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_music_forge_config_revisions_one_active
    ON music_forge_config_revisions (status)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS music_forge_lanes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    lane_key TEXT NOT NULL,
    ugs_workflow TEXT NOT NULL,
    ace_workflow TEXT NOT NULL,
    model_scope TEXT NOT NULL,
    workflow_file TEXT NOT NULL,
    billing_mode TEXT NOT NULL,
    ksampler_use_comfy_template BOOLEAN NOT NULL DEFAULT FALSE,
    markers JSONB NOT NULL DEFAULT '[]'::jsonb,
    sampler JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_lanes_revision_lane UNIQUE (revision_id, lane_key)
);

CREATE INDEX IF NOT EXISTS idx_music_forge_lanes_revision
    ON music_forge_lanes (revision_id, sort_order);

CREATE TABLE IF NOT EXISTS music_forge_style_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    style_key TEXT NOT NULL,
    keyscale TEXT NOT NULL,
    default_vocal TEXT,
    bpm_default INTEGER,
    textures JSONB NOT NULL DEFAULT '{}'::jsonb,
    arrangement JSONB NOT NULL DEFAULT '{}'::jsonb,
    voice JSONB NOT NULL DEFAULT '{}'::jsonb,
    soloist_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_style_profiles_revision_key UNIQUE (revision_id, style_key)
);

CREATE INDEX IF NOT EXISTS idx_music_forge_style_profiles_revision
    ON music_forge_style_profiles (revision_id);

CREATE TABLE IF NOT EXISTS music_forge_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('blueprint', 'lyrics', 'style')),
    system_prompt TEXT NOT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    extras JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_prompt_templates_revision_kind UNIQUE (revision_id, kind)
);

CREATE TABLE IF NOT EXISTS music_forge_product_settings (
    revision_id UUID PRIMARY KEY REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    duration_min INTEGER NOT NULL DEFAULT 60,
    duration_max INTEGER NOT NULL DEFAULT 240,
    duration_default INTEGER NOT NULL DEFAULT 180,
    mvp_lane_label TEXT NOT NULL DEFAULT 'SFT XL (default) | BASE XL | TURBO XL',
    max_completed_runs_per_day INTEGER,
    max_completed_runs_per_month INTEGER,
    audio_type_key TEXT NOT NULL DEFAULT 'music_generator_evolution_xl_base',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed v1-platform active revision (matches algorithm module defaults).
INSERT INTO music_forge_config_revisions (id, version, status, notes, activated_at)
VALUES (
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'v1-platform',
    'active',
    'Initial platform defaults seeded from algorithm/lanes.py, constants.py, style.py, prompts.py',
    NOW()
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO music_forge_lanes (
    revision_id, lane_key, ugs_workflow, ace_workflow, model_scope, workflow_file,
    billing_mode, ksampler_use_comfy_template, markers, sampler, is_default, sort_order
) VALUES
(
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'SFT XL', 'v4', 'v4', 'xl_sft', 'ace_sft_new.json', 'music_forge_xl_sft', FALSE,
    '[]'::jsonb,
    '{
        "temperature": 0.85, "cfg_scale": 2.10, "top_p": 0.91, "top_k": 0, "min_p": 0.0,
        "cfg": 7.0, "steps": 50, "sampler_name": "jkass_quality", "scheduler": "sgm_uniform",
        "generate_audio_codes": true, "timesignature": "4"
    }'::jsonb,
    TRUE, 1
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'BASE XL', 'v2_base', 'v2_base', 'xl_base', 'Musicv2_base.json', 'music_forge_xl_base', TRUE,
    '["base xl", "xl base", "xl_base", "v2_base", "musicv2_base"]'::jsonb,
    '{}'::jsonb,
    FALSE, 2
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'TURBO XL', 'v2', 'v2', 'xl_turbo', 'Musicv2.json', 'music_forge_xl_turbo', FALSE,
    '["turbo", "xl turbo", "xl_turbo", "fast turbo", "быстрый turbo"]'::jsonb,
    '{}'::jsonb,
    FALSE, 3
)
ON CONFLICT (revision_id, lane_key) DO NOTHING;

INSERT INTO music_forge_style_profiles (
    revision_id, style_key, keyscale, default_vocal, bpm_default, textures, arrangement, voice
) VALUES
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'pop', 'A minor', NULL, 112,
    '{"intro": "dreamy synth pad, light reverb", "verse": "pulse bass, sparse drums, clean texture", "pre": "rising synth sweep, subtle kick entry", "chorus": "wide emotional pads, soft driving drums", "verse2": "prominent bassline, gentle percussion", "pre2": "rising texture, increased vocal urgency", "chorus2": "stronger pads, emotive vocal layering", "bridge": "stripped ambient pads, close-mic vocal", "chorus3": "full instrumentation, powerful delivery", "outro": "slow synth decay, long reverb, breathy last line"}'::jsonb,
    '{"intro": "Clean electric guitar motif, room drums count-in, {bpm} BPM feel", "verse": "Live kit, bass, jangly guitar, {bpm} BPM", "pre-chorus": "Added snare lift, second guitar, {bpm} BPM", "chorus": "Full indie-rock stack, open hats, {bpm} BPM", "bridge": "Breakdown guitar + tom fill, {bpm} BPM", "outro": "Guitar feedback fade, {bpm} BPM feel"}'::jsonb,
    '{"intro": "dry close lead, indie intimacy", "verse": "conversational belt, slight grit", "pre-chorus": "push into hook, clear consonants", "chorus": "anthemic but human, doubled lead", "bridge": "raw near-mic, emotional peak", "outro": "soft landing, spoken-sung tail"}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'drum and bass', 'D minor', 'female', 174,
    '{"intro": "amen chop filter, Reese sub swell", "verse": "rolling breaks, dark Reese bass, sparse snare", "pre": "snare roll build, rising noise", "chorus": "full amen energy, supersaw stab, heavy sub", "verse2": "tighter breaks, bass growl", "pre2": "longer snare roll, white noise riser", "chorus2": "maximal break energy, layered stabs", "bridge": "half-time break, vocal focus", "chorus3": "full power return, wide stereo", "outro": "breaks dissolve, long reverb, sub fade"}'::jsonb,
    '{"intro": "Amen chop filter, Reese sub swell, {bpm} BPM feel", "verse": "Rolling breaks, dark Reese bass, sparse snare, {bpm} BPM", "pre-chorus": "Snare roll build, rising noise, {bpm} BPM", "chorus": "Full amen energy, wide supersaw stab, heavy sub, {bpm} BPM", "bridge": "Half-time break, filtered Reese, vocal focus, {bpm} BPM", "outro": "Breaks dissolve into reverb, sub fade, {bpm} BPM feel"}'::jsonb,
    '{"intro": "breathy close-mic, tense anticipation", "verse": "rhythmic narrative, dry intimate, clear diction", "pre-chorus": "urgency lift, sharp consonants", "chorus": "powerful belt, forward hook, light plate", "bridge": "hushed confession over half-time", "outro": "whispered last line, no wordless scream"}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'house', 'F minor', NULL, 128,
    '{"intro": "four-on-floor kick, filtered pad, disco hat", "verse": "pulsing bassline, light hats, warm keys", "pre": "filter open, clap entry, rising pad", "chorus": "wide house stack, sidechain pads, driving kick", "verse2": "groovier bass, shaker detail", "pre2": "filter sweep, hat intensity up", "chorus2": "fuller pads, emotive vocal layering", "bridge": "breakdown pads + vocal, kick mute", "chorus3": "full instrumentation, powerful delivery", "outro": "kick fade, looping stab, reverb tail"}'::jsonb,
    '{"intro": "Four-on-floor kick, filtered pad, disco hat, {bpm} BPM feel", "verse": "Pulsing bassline, light hats, warm keys, {bpm} BPM", "pre-chorus": "Filter open, clap entry, rising pad, {bpm} BPM", "chorus": "Wide house stack, sidechain pads, driving kick, {bpm} BPM", "bridge": "Breakdown: pads + vocal, kick mute, {bpm} BPM", "outro": "Kick fade, looping stab, long reverb, {bpm} BPM feel"}'::jsonb,
    '{"intro": "soft breathy, club intimacy", "verse": "groove talk-sing, clear diction", "pre-chorus": "rising urgency, open vowels on words", "chorus": "anthemic house lead, doubled hook", "bridge": "close-mic emotional, sparse", "outro": "fade whisper on lexical line"}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'lofi_chill', 'D minor', 'male', 82,
    '{"intro": "dreamy synth pad, light reverb", "verse": "pulse bass, sparse drums, clean texture", "pre": "rising synth sweep, subtle kick entry", "chorus": "wide emotional pads, soft driving drums", "verse2": "prominent bassline, gentle percussion", "pre2": "rising texture, increased vocal urgency", "chorus2": "stronger pads, emotive vocal layering", "bridge": "stripped ambient pads, close-mic vocal", "chorus3": "full instrumentation, powerful delivery", "outro": "slow synth decay, long reverb, breathy last line"}'::jsonb,
    '{"intro": "Vinyl crackle, soft Rhodes stab, dusty kick, {bpm} BPM feel", "verse": "Boom-bap loop, muted Rhodes, upright bass, {bpm} BPM", "pre-chorus": "Filtered hats, rising pad, {bpm} BPM", "chorus": "Fuller Rhodes chords, soft snare, warm sub, {bpm} BPM", "bridge": "Stripped vinyl + Rhodes motif, {bpm} BPM", "outro": "Tape fade, crackle tail, {bpm} BPM feel"}'::jsonb,
    '{"intro": "warm close-mic, intimate, low dynamics", "verse": "narrative, dry intimate, clear diction", "pre-chorus": "soft lift, breathy but lexical", "chorus": "singable hook, chest-forward, light plate reverb", "bridge": "hushed confessional, close-mic", "outro": "fade whisper on words, no wordless pad"}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'indie_rock', 'A major', NULL, 124,
    '{"intro": "dreamy synth pad, light reverb", "verse": "pulse bass, sparse drums, clean texture", "pre": "rising synth sweep, subtle kick entry", "chorus": "wide emotional pads, soft driving drums", "verse2": "prominent bassline, gentle percussion", "pre2": "rising texture, increased vocal urgency", "chorus2": "stronger pads, emotive vocal layering", "bridge": "stripped ambient pads, close-mic vocal", "chorus3": "full instrumentation, powerful delivery", "outro": "slow synth decay, long reverb, breathy last line"}'::jsonb,
    '{"intro": "Clean electric guitar motif, room drums count-in, {bpm} BPM feel", "verse": "Live kit, bass, jangly guitar, {bpm} BPM", "pre-chorus": "Added snare lift, second guitar, {bpm} BPM", "chorus": "Full indie-rock stack, open hats, {bpm} BPM", "bridge": "Breakdown guitar + tom fill, {bpm} BPM", "outro": "Guitar feedback fade, {bpm} BPM feel"}'::jsonb,
    '{"intro": "dry close lead, indie intimacy", "verse": "conversational belt, slight grit", "pre-chorus": "push into hook, clear consonants", "chorus": "anthemic but human, doubled lead", "bridge": "raw near-mic, emotional peak", "outro": "soft landing, spoken-sung tail"}'::jsonb
)
ON CONFLICT (revision_id, style_key) DO NOTHING;

INSERT INTO music_forge_prompt_templates (revision_id, kind, system_prompt, rules, extras) VALUES
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'blueprint',
    'You are MusicForge, a backend song architect. Return only valid JSON. Design one full-length memorable song plan for AceStep SFT vocal production. No markdown.',
    '["When liked_recipe_hints conflict with user_intent style_hint or constraints, follow user_intent first.", "Use liked hints for vocal clarity and hook structure, not to override explicit genre/tempo requests."]'::jsonb,
    '{}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'lyrics',
    'Write only sung lyrics in {language_note}. Use ACE section markers: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Chorus 2], [Outro]. No JSON, no markdown fences, no explanations. Write a full song: short singable lines, clear stress, audible rhyme or near-rhyme in chorus. Every sung line must contain real words — no standalone ooh/aah/mm adlibs.',
    '["Include Intro, at least two Verses, Pre-Chorus, Chorus repeats, Bridge, and Outro.", "Chorus must contain the hook phrase or a very close variation.", "Use concrete images from the idea; keep ≥16 sung lines total for a full track.", "Prefer living spoken phrasing over poetic fog; lines must be easy to sing aloud.", "Avoid generic filler such as destiny, endless dreams, shining stars unless user asked.", "Do not mention AI, ACE, ComfyUI, workflow, sampler, LoRA, JSON.", "Do not write standalone vocalizations like о-о-о, а-а-а, ммм, ooh, ahh, yeah.", "Start each section with a lexical phrase, not a moan or vocal run."]'::jsonb,
    '{}'::jsonb
),
(
    'a1111111-1111-4111-8111-111111111111'::uuid, 'style',
    'Return only one English AceStep style caption, no JSON and no markdown. Start with BPM, vocal gender, and genre, then a full song arc with Title Case bracket sections: [Intro], [Verse], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus 2], [Chorus 2], [Bridge], [Chorus 3], [Outro]. Never use lowercase [intro]/[verse]. Name concrete instruments, groove, and modern production.',
    '["Do not mention ACE, ComfyUI, model, sampler, LoRA or workflow.", "Match resolved_style_key and style_hint with concrete textures (not vague ''emotional'').", "Lead vocal must be forward, human, and syllable-clear; light natural vibrato OK.", "Include an explicit BPM number early in the caption.", "Section markers must be Title Case to match lyrics headers ([Intro] not [intro]).", "Keep under 1600 characters; prefer dense production detail over short prose."]'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (revision_id, kind) DO NOTHING;

INSERT INTO music_forge_product_settings (
    revision_id, duration_min, duration_max, duration_default,
    mvp_lane_label, audio_type_key
) VALUES (
    'a1111111-1111-4111-8111-111111111111'::uuid,
    60, 240, 180,
    'SFT XL (default) | BASE XL | TURBO XL',
    'music_generator_evolution_xl_base'
)
ON CONFLICT (revision_id) DO NOTHING;

COMMIT;
