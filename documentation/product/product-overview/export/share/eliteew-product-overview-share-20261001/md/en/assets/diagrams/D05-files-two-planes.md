# D05 — Files: two planes (P4a)

```mermaid
flowchart TB
  UI["File manager"]
  PG["PostgreSQL\nmetadata · ACL · versions · project"]
  OBJ["Object store S3-class\nfile bytes\nSeaweedFS in Empery contour"]
  UI --> PG
  UI --> OBJ```

