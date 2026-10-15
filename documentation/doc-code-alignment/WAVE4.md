# Alignment remediation — Wave 4 (2026-09-30)

Residual actionable triage + domain_matrix + buyer-export link hygiene.

## Done

| Area | Change |
|------|--------|
| `.cursor/domain_matrix.json` | `eliteew_scripts` → `scripts/**` (+ `scripts/eliteew/**`); `eliteew_webview` → soft-retired / living docs only; `updated` 2026-09-30 |
| Public-buyer export MD | Fixed 6 broken `export/md/README.md` relative links → same-dir `README.md` |
| Trusted Substrate readiness | Dead solution-readiness wave files → stub README |
| Audit extractor | Strip CLI flags (`script.sh --yes`) so existing scripts are not false-missed |
| Classifier | `expected_runtime_host_path` for `docker/data|logs|host_conf`; historical lan-workers punisher/debian helpers → intentional absent |

## Audit delta (cumulative)

| Metric | Start audit | After Wave 4 |
|--------|------------:|-------------:|
| Path mismatch | 442 | **325** |
| Actionable candidates | 226 | **80** |
| Broken internal `.md` links | 14 | **0** |
| Intentional absent/untracked | 0 | **32** |

## Remaining (~80 actionable)

Mostly single-cite historical ops helpers (`diagnose-app-404`, `redis-flush`, pack-mobile archive, voice ref scripts, missing product md stubs). Next pass can either restore from `trash/` when needed or mark intentional in classifier as they are reviewed.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
