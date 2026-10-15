# EliteEW — diagrams D01–D12 (Markdown / Mermaid)

Sources also under [`assets/diagrams/`](assets/diagrams/).

# D01 — Hybrid formula (P1)

```mermaid
flowchart LR
  subgraph Host["Host device"]
    OS["Desktop / server OS / VR browser"]
  end
  subgraph Elite["EliteEW work layer"]
    Desk["Desk + apps + files"]
    Sec["Perimeter + roles + access"]
  end
  OS --> Elite
  Desk --- Sec```

---

# D02 — Threat classes → responses (P2)

```mermaid
flowchart TB
  subgraph Threats["Threat classes"]
    T1["Shadow IT / personal messenger"]
    T2["Personal clouds"]
    T3["Copy-paste / external AI"]
    T4["BYOD without separation"]
    T5["Analog: screen photo"]
  end
  subgraph Answers["EliteEW responses"]
    A1["Work layer + internal chat"]
    A2["Managed files"]
    A3["AI in project contour"]
    A4["Browser / APK without admin agent"]
    A5["Minimization · not 100%"]
  end
  T1 --> A1
  T2 --> A2
  T3 --> A3
  T4 --> A4
  T5 -.->|"not absolute"| A5```

---

# D03 — Norms: EliteEW contributes / stays with org (P3)

```mermaid
flowchart LR
  subgraph NPA["Regulatory orientations"]
    N1["Information protection"]
    N2["Cross-border data"]
    N3["AI use"]
    N4["Personal data"]
  end
  subgraph EE["EliteEW contributes"]
    E1["Perimeter · roles · access"]
    E2["Edition data contour"]
    E3["AI in contour"]
  end
  subgraph Cust["Stays with the organization"]
    C1["Certification · protective tools"]
    C2["Legal bases · policies"]
    C3["Data controller"]
  end
  N1 --> E1
  N1 --> C1
  N2 --> E2
  N2 --> C2
  N3 --> E3
  N3 --> C2
  N4 --> E1
  N4 --> C3```

---

# D04 — Employee day (P3a)

```mermaid
flowchart LR
  S1["Sign-in"] --> S2["Desk + apps"]
  S2 --> S3["Files / documents"]
  S3 --> S4["GAF comms / calls"]
  S4 --> S5["Project / marketing"]
  S5 --> S6["AI in contour"]
  S6 --> S7["Mobile satellite"]```

---

# D05 — Files: two planes (P4a)

```mermaid
flowchart TB
  UI["File manager"]
  PG["PostgreSQL\nmetadata · ACL · versions · project"]
  OBJ["Object store S3-class\nfile bytes\nSeaweedFS in Empery contour"]
  UI --> PG
  UI --> OBJ```

---

# D06 — Edge: wall and one click (P7d)

```mermaid
flowchart LR
  Scan["Scanner / foreign internet"] -->|extra entries closed| Wall["Blind wall"]
  Trust["Trusted\nissued key / seat"] -->|1 action| Chan["Protected channel"]
  Chan --> Work["EliteEW work contour"]```

---

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

---

# D08 — Editions (P10)

```mermaid
flowchart TB
  subgraph One["One EliteEW product"]
    Cloud["Cloud · hosted"]
    Onprem["On-prem · organization contour"]
    Client["Client · device"]
  end
  FoF["FoFline · local pack + channel\n≠ air-gap"]
  Client -.-> FoF```

---

# D09 — Cost structure: three columns (P3d)

```mermaid
flowchart TB
  subgraph Win["Typical desktop contour"]
    W1["OS + agents + external services"]
  end
  subgraph Ubu["Self-host DIY"]
    U1["Build + support payroll"]
  end
  subgraph EE["EliteEW"]
    E1["Contour + host as-is"]
  end
  Note["Self-host costs · not gift valuation · orientation"]
  Win -.-> Note
  Ubu -.-> Note
  EE -.-> Note```

---

# D10 — Reading paths (P0)

```mermaid
flowchart TB
  P0["P0 Contents"]
  P0 --> ORG["Organization / adoption"]
  P0 --> CISO["Security / perimeter"]
  P0 --> IND["Industry / employee day"]
  P0 --> SI["Migration / integrator"]
  P0 --> FULL["Full spine"]
  ORG --> A1["P1 · P3e · P3c"]
  A1 --> A2["P3f · P3g · DD · P12"]
  CISO --> C1["P2 threats"]
  C1 --> C2["P7d edge · P9a · P8a"]
  IND --> I1["P1 · P3a"]
  I1 --> I2["P3b · P3e · P3d"]
  SI --> S1["P3e · P3f · P3g"]
  S1 --> S2["P10c · P5a"]
  FULL --> F1["P0 → P14 + glossary"]```

---

# D11 — Gift to the world: MIT and optional accompaniment (P3e)

```mermaid
flowchart LR
  Gift["Gift to the world · MIT first-party"]
  Gift --> Run["Run / study / modify"]
  Gift --> Share["Share under MIT"]
  Gift --> Net["Modified network service → source to its users"]
  Run --> Org["Organization’s own contour"]
  Share --> Org
  Help["Optional accompaniment"]
  Help --> Accept["Help with acceptance / SBOM"]
  Help --> Ops["Help with operations"]
  Accept --> Org
  Ops --> Org```

принять и крутить контур, но **не** подменяет и не закрывает исходники.

---

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

---

