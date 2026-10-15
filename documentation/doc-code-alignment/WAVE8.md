# Alignment remediation — Wave 8 (2026-09-30)

Reduce high-cite noise: expand canon set-notation, neutralize EliteEW/.cursor ban tokens, finish mobile ellipsis, strip LAN-WORKERS absent script path prefixes.

## Done

| Area | Change |
|------|--------|
| Canon set-notation | `documentation/{product,platform,…}/` → five explicit `documentation/*/ ` dirs |
| EliteEW/.cursor | Ban/mirror mentions → prose (no `EliteEW/.cursor` path_ref) |
| trash/20260812-162347/… | Soft-retired under `trash/` (timestamp) — no ellipsis path_ref |
| Mobile shell | `MobileShellNavigation.kt` / `MobileShellTabErrors.kt` → full Java paths |
| first-meet seeds | `{seed}.mp4` → directory + listed seed names |
| LAN-WORKERS | Historical `gpu141-debian-*` / `punisher-*` → basenames (path prefix removed) |
| docker/build/ | Ban prose without living path_ref; SoT remains `docker/builders/` |

## Audit delta

| Metric | After Wave 7 | After Wave 8 |
|--------|-------------:|-------------:|
| Path mismatch | 165 | **137** |
| Unique missing | 121 | **107** |
| Path matches | 2835 | **2876** |
| Actionable | 0 | **0** |
| Broken internal links | 0 | **0** |
| `noise_brace_expansion` | 7 | **4** |
| Intentional absent | 47 | **41** |

## Left (classified, not rewrite blockers)

Podman local image tags (`local/eliteew-site-prod:secure`), forbidden-alias ban lists in writing guides, soft-retire `trash/` history folders, runtime/secrets paths, remaining placeholder ellipsis (`<slug>`, `<ver>`).

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
