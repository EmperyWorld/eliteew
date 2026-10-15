# Ассистент — Playwright E2E CI

Mock SSE golden-path for Ассистент wiring (composer → stream → messages).

## Local run (mock)

From `shared/web/frontend`:

```bash
pnpm run test:e2e:desktop-ai-chat
```

Environment:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DESKTOP_AI_CHAT_E2E_RUN=1` | yes | Gate in `e2e/desktopAiChatE2eGate.ts` |
| `AI_CHAT_E2E_MOCK_STREAM=1` | yes (CI) | Replay `shared/api/tests/fixtures/desktop_chat_done_context_sse_golden.sse` |
| `MC_E2E_BASE_URL` | yes | App base URL (http/https) |

## CI

Workflow: `.github/workflows/desktop-ai-chat-e2e.yml` — runs on PR when desktop-ai-chat paths change (FE feature + e2e helpers; API `desktop_ai_chat*.py`, `desktop_chat/**`, `desktop_chat_ensemble/**`). Gated by `DESKTOP_AI_CHAT_E2E_RUN=1` + mock SSE (`AI_CHAT_E2E_MOCK_STREAM=1`); not a substitute for Vitest contract suite.

Live stack2 stream (optional weekly) is out of scope for PR gate; use operator smoke on command-center when needed.

## Related

- `documentation/product/DESKTOP-LLAMA-CHAT.md` — product canon
- `e2e/desktopAiChatRuntimeSmoke.ts` — open Ассистент window helper
