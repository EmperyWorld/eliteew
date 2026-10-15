# P4a — Files: metadata, object store, access, search

**Diagram:** [D05](assets/diagrams/D05-files-two-planes.md)

## Two planes (honestly)

| Plane | What it holds | Meaning for the organization |
|-------|---------------|------------------------------|
| **PostgreSQL** | Metadata, versions, ACL, company/project binding | Who can see a file and which project it belongs to |
| **Object store (S3-class; Empery contour uses SeaweedFS)** | File bytes | Content is not “only on the employee’s laptop disk” as the sole source of truth |

People work through the **file manager**; they do not touch PG or Seaweed by hand.

## What the contour can do

- One library with folders, versions, sharing, and storage quota
- Scope by **company / project** (including a marketing project vault)
- Search: full text and **smart** search (full text + semantics over the document index)
- After text extraction / OCR of scans, material becomes findable (platform-side processing; not “100% magic on every scan”)

Comparisons — [P1](01-what-is-eliteew.md); limits — [P12](12-honest-limits.md).
