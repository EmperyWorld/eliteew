# D12 — Accept the gift locally (P3f)

```mermaid
flowchart TB
  Source["MIT source · commit/tag"]
  Source --> Check["Artifact check"]
  Check --> Build["Build / staging"]
  Check --> Docs["Docs + SBOM / NOTICE"]
  Build --> Pilot["Org-unit pilot"]
  Pilot --> Scale["Scale with own service"]
  Help["Optional accompaniment"] -.-> Check
  Help -.-> Pilot```

документацию и границы. Чужие prod-секреты в «дар» не входят.
