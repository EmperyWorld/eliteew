# Alignment remediation — Wave 7 (2026-09-30)

Noise reduction: expand brace/ellipsis cites to real paths; neutralize mid-alias brace tokens; drop full-path cites for intentionally absent smoke helpers.

## Done

| Area | Change |
|------|--------|
| i18n braces | `{ru,en}/…json` → explicit `locales/ru/…` + `locales/en/…` |
| Trusted Substrate braces | `scripts/{image-sign,…}.sh` → `pack-organization/trusted-substrate/scripts/` + basenames |
| Mobile ellipsis | `pack-cloud/mobile/.../*.kt` → full `src/main/java/…` / test paths |
| content_storage brace | `content_storage_{service,list,shared}.py` → three real modules |
| `.vscode/{settings,…}` | Expanded to four files |
| Pack / editions braces | Mid-alias `EliteEW/{api,…}` and `host/{…}` → prose; `trash/…/EWGen` etc. → soft-retired under `trash/` |
| DESKTOP-LLAMA smoke | Absent `docker/scripts/desktop-ai-chat-*.sh` cites → basenames + honesty (no false path_ref) |
| Guide audio / LAN-WORKERS | Absent helpers marked; LAN-WORKERS note for historical debian/punisher scripts |

## Audit delta

| Metric | After Wave 6 | After Wave 7 |
|--------|-------------:|-------------:|
| Path mismatch | 200 | **165** |
| Unique missing | 154 | **121** |
| Actionable | 0 | **0** |
| Broken internal links | 0 | **0** |
| `noise_brace_expansion` | 22 | **7** |
| `noise_ellipsis_placeholder` | 44 | **36** |
| Intentional absent | 57 | **47** |

## Left

Forbidden-alias ban mentions, soft-retire `trash/` history timestamps, runtime/secrets paths, remaining brace set-notation in writing guides (`documentation/{product,…}/`), podman local image refs.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
