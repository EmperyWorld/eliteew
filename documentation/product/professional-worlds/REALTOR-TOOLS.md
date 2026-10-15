# Realtor tools

Техническая и пользовательская документация по единой экосистеме риелторских инструментов внутри Professional Worlds.

**Canon path:** `documentation/product/professional-worlds/REALTOR-TOOLS.md` (relocated from former `EliteEW/REALTOR_TOOLS_DOCS.md`).

## End-to-End User Flow

1. Открыть EliteEW Desktop → Professional Worlds → активировать вертикаль `realtor`.
2. Заполнить профиль специалиста и базовый brand kit.
3. Создать объект вручную или через AI object intake.
4. Выбрать объект в Objects: workspace `selectedPropertyId` становится единым контекстом для listing-centric панелей.
5. Дальше из активного объекта:
   - создать клиента/сделку через Clients capture;
   - запланировать показ через `realtor_showings`;
   - открыть документы через `realtor_documents`;
   - открыть маркетинг через `realtor_marketing`;
   - проверить цену/качество через `realtor_insights`;
   - записать коммуникацию через `realtor_communications`.
6. Лид из `realtor_leads` конвертируется в клиента, затем ведет к client directory, deal capture и pipeline.
7. Показы и задачи открывают связанный объект, клиента, сделку и communication log через существующие `open*` контракты.
8. Generated artifacts передаются в EWRP, Site Studio, GAF Chat, EWDesk или Файловый менеджер через one-shot draft capsule.
9. Overview показывает pulse metrics, Today's focus и summary активного realtor context: объект, клиент, сделка, showings/tasks entry points.

## Architecture Links

| Layer | Contract |
|-------|----------|
| Desktop root | `ProfessionalWorldsApp` owns snapshot, selected property, CRM drafts and workspace navigation. |
| Shared context | `ProfessionalWorldsWorkspaceContext` exposes `openClients`, `openProperties`, `openPipeline`, `openCommunications`, `openProfessionTool`, `selectedPropertyId`. |
| Objects | `RealtorObjectsWorkspacePanel` updates `selectedPropertyId` and offers next-step CTAs without creating hidden data. |
| Realtor addons | `RealtorProPanels` uses `selectedPropertyId` as preferred listing for showings, documents, marketing and insights. |
| Cross-app drafts | `openProfessionalDraftDestination` writes a `sessionStorage` capsule and dispatches `desktop-open-app` with `professionalWorldsCrossAppDraftKey`. |
| Downstream consumers | `professionalWorldsCrossAppDraft.ts` parses the capsule for Site Studio, GAF Chat and EWDesk; EWRP keeps its existing consumer. |
| Persistence safety | `sanitizeWindowPayloadForShellPersistence` strips `professionalWorldsCrossAppDraftKey` before `windows_snapshot` persistence. |

## Cross-App Draft Behavior

- EWRP: fills presentation topic/title/context.
- Site Studio: prefills setup title/topic/brief or assistant message for an existing workspace.
- GAF Chat: prepares composer seed and optional Unified Content attachment after chat selection.
- EWDesk: shows an operator-visible markdown draft card; publishing remains manual.
- Файловый менеджер: keeps Unified Content focus/link handoff; no auto-publish.

Invariant: cross-app drafts never send messages, publish posts, launch public sites, or create marketing cabinet projects automatically.

## Developer Guidelines

- Do not create a second realtor app. Extend Professional Worlds and `realtor_*` modules.
- Keep object-centric navigation on `selectedPropertyId`; avoid query-string bridges inside Professional Worlds unless crossing Desktop app boundaries.
- Add new panel links through `ProfessionalWorldsWorkspaceContext`, not direct imports between panels.
- Add any new destination draft consumer to `professionalWorldsCrossAppDraft.ts` and strip one-shot keys from persistence.
- Marketing Cabinet integration must be an explicit adapter with its own API contract; do not reuse Realtor Marketing tables directly.
- If tasks/showings become part of aggregate snapshot later, update Overview summary to show real nearest rows instead of addon entry points.

## Operator Smoke

1. Open Desktop → Professional Worlds → `realtor`.
2. Create or select a listing in Objects.
3. Use active listing CTAs: Create deal, Showings calendar, Document checklist, Marketing campaigns, Price and listing quality insights.
4. Confirm Documents/Marketing/Insights open with the same listing selected.
5. Generate an artifact and hand it off to EWRP, Site Studio, GAF Chat, and EWDesk.
6. Confirm each destination receives a draft only, with no auto-send and no auto-publish.
7. Return to Overview and confirm Realtor context displays the active listing, linked client/deal where available, and showings/tasks entry points.

## Verification Used

- `pnpm exec biome check --write --formatter-enabled=false <changed ts/tsx files>`
- `pnpm exec vitest run --passWithNoTests professionalWorldsCrossAppDraft.test.ts desktopOpenPayloads.test.ts sanitizePersistedDesktopWindowPayload.test.ts OverviewWorkspacePanel.test.tsx RealtorObjectsWorkspacePanel.test.tsx RealtorProPanels.test.tsx`
- `pnpm run i18n:check`
- `pnpm run build:react-compiler`
- `node scripts/verify-app-build-id.mjs`

## Future Integrations

- MLS/feed/import provider as a dedicated integration binding.
- External calendar sync for real showing events.
- Legal document lifecycle: templates, review statuses, e-sign provider, audit trail.
- Whole-context realtor AI assistant across listing, client, deal, showing, tasks, documents and communications.
- Weekly operating plan: follow-up risk, stale deals, content plan and overdue tasks.
- Agency team mode: shared listings, assistants, SLA and material quality control.
