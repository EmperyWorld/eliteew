# Alignment remediation — Wave 9 (2026-09-30)

Harden path extractor against image tags / placeholders; soften highest-cite ban, trash, and intentionally-absent path refs so they are no longer path-shaped.

## Done

| Area | Change |
|------|--------|
| Extractor | `clean_path_token` rejects `< > … \| { }` and any `:` (OCI tags, bind mounts) |
| Forbidden aliases | Ban lists → non-slash prose (`EliteEW docs`, `docker re_doc`, `documentation archive`, …) |
| Unhooked gates | Language-bridge / Tauri rule·skill·agent cites → basename honesty (*intentionally unhooked*) without `.cursor/…` path_ref |
| Planned W4 | `install-community.sh` / `community.yml` → planned-not-in-tree prose |
| Kill-switch / optional | `.disable-stack9-voice`, `KBSEW pyrightconfig`, `shared web auth` → honesty without extractable path |
| Soft-retire | `trash EliteEWWebViewAndroid` prose (no `trash/EliteEWWebViewAndroid/` path_ref) |

## Audit delta

| Metric | After Wave 8 | After Wave 9 |
|--------|-------------:|-------------:|
| Path mismatch | 137 | **61** |
| Unique missing | 107 | **53** |
| Path matches | 2876 | **2875** |
| Actionable | 0 | **0** |
| Broken internal links | 0 | **0** |
| Intentional absent | 41 | **29** |
| Soft-retire cites | — | **13** |
| Ellipsis noise | 4 | **4** |

## Left (classified, not rewrite blockers)

Soft-retire `trash/<timestamp>/` history cites, intentional absent ops helpers, secrets/runtime host paths, four Kotlin/FE `.../` ellipsis stubs.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
