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

