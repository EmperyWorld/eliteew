# Desktop LLM prompt-template directory

This directory reserves a location for future versioned system/developer templates. It currently contains this guide rather than a gateway-loaded template registry. Do not infer that template selection/version negotiation exists from the directory name.

The implemented companion prose registry is [companion/prompt_blocks](../../companion/prompt_blocks/) with [canon](../../companion/prompt_blocks/canon.py), PG overrides and a process-local resolver. Its full catalog, precedence, admin API and reload limits are documented in [EWA prompt blocks](../../../../../documentation/product/ewa/EWA-COMPANION-PROMPT-BLOCKS.md). Desktop orchestration uses its [proposal flow](../../docs/POLICY-LLM-MATRIX.md), which has a separate scope.

Future templates should have an explicit caller, id/version/fallback contract and tests; keep secrets and per-tenant personal data out of shared prose. This guide does not authorize a new template loader or application change.
