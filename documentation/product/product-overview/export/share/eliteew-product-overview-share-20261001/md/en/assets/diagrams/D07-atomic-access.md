# D07 — Atomic conditional access (P8a)

```mermaid
flowchart TB
  I["Identity"] --> AND{"All true?"}
  L["Entitlement active"] --> AND
  C["Channel allowed"] --> AND
  D["Device / key"] --> AND
  B["Account binding"] --> AND
  AND -->|yes| OK["Product access"]
  AND -->|no| DENY["Deny · no detailed oracle"]```

