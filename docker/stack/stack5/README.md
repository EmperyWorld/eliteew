# stack5 (retained — not default prod)

SearXNG / Crawl4AI era compose lives in `../stack5.yml`.

| File | Role |
|------|------|
| `searxng.settings.yml` | Reference SearXNG settings (not mounted unless resurrected) |

Do **not** resurrect on prod-core without an explicit operator task. Canon: `PRODUCTION-TOPOLOGY-STATE.md` / stack retirement notes.
