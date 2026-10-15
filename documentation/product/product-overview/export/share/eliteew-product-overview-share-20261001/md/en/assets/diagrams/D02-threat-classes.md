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

