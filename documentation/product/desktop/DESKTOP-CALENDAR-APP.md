# Desktop CalendarApp and personal events

CalendarApp is an implemented desktop window for owner-scoped personal events, with a month/week grid, a selected-day agenda and an editor. It also projects dated assistant-plan tasks into the grid. Personal events and assistant plans have separate persistence and mutation APIs.

Source review: 2026-10-11. This guide replaces the earlier implementation-wave target. It describes inspected sources and bounded tests; deployed schema, browser/device behavior and general desktop-shell acceptance remain separate. Historical notes at `documentation/plans/product/desktop/DESKTOP-CALENDAR-APP-PLAN.md` are operator-local and ignored by Git, rather than living contracts.

## Ownership and entry points

- [Calendar manifest](../../../shared/apps/calendar/app.manifest.yaml): app id `calendar`, component `CalendarApp`, catalog id `app-calendar`, cloud/onprem/client defaults, auth/Postgres requirements and `offline: partial`.
- [Window](../../../shared/web/frontend/src/pages/Desktop/apps/CalendarApp.tsx) and [UI components](../../../shared/web/frontend/src/pages/Desktop/apps/calendarApp/): presentation, selected day/view/search/editor state and personal/plan mutation selection.
- [REST router](../../../shared/api/routers/desktop_calendar.py), [event service](../../../shared/api/services/desktop_calendar_events.py) and [policy](../../../shared/api/services/desktop_calendar_policy.py): personal-event CRUD.
- [ORM](../../../shared/api/models/desktop.py) and [migration](../../../shared/api/migrations/applied/20260819_01_desktop_calendar_events.sql): `desktop_calendar_events` in the main application PostgreSQL, with `user_id` referencing `users.id` and deletion cascading from the user.
- [Companion calendar](../../../shared/api/ewa_platform/companion/calendar/) and [tool handler](../../../shared/api/ewa_platform/companion/orchestration/tools/handlers_ops.py): direct personal-event listing/creation through the main pool.

The inspected `onprem-team-core` and `fofline-connected` install profiles both include calendar. Profile/catalog enablement controls discovery; these REST routes do not independently check that install profile. The manifest's partial-offline label does not establish a local durable event store or an offline write queue.

Open Calendar through Start/catalog. The command-palette `calendar` entry displays today's date and has a no-op action; it does not launch CalendarApp. Taskbar date navigation can open the app through its one-shot [calendar deep link](../../../shared/web/frontend/src/pages/Desktop/utils/calendarDeepLink.ts). The selected day and view live in component state rather than `shell_state`.

## Window journey

The toolbar provides range navigation, Today, a month-jump popover, month/week selection and title/notes search. The selected-day strip shows the date, count and a new-event action. Month view uses 42 Monday-first cells; week view uses seven Monday-first cells. Both grids show up to three event chips per cell and a further-items control. Clicking a chip selects it for editing; dragging a chip to another day invokes the appropriate personal-event or plan-task mutation.

The day agenda orders all-day entries first, then start time/title. It shows intervals, notes and personal/assistant-plan styling. Search filters the loaded range on lowercased title and notes; it is not a server search. The highlight helper prefers a current entry, then a future entry, then the first entry. Relative status is calculated on render; there is no independent timer in that helper.

The editor supports title, notes, all-day, start/end fields, duration presets of 30/60/120 minutes, save/cancel, duplicate and a two-step delete/complete confirmation. A new timed event defaults to 09:00–10:00 on the selected browser-local day. All-day UI intervals use local 00:00–23:59. Start changes that would meet/pass the end move the end forward by an hour. Form validation disables invalid submission and shows local feedback; server policy remains authoritative.

Date/time fields and month-jump controls use the shell's `embedded_popover` portal with fixed anchors. The date/time control follows resize/scroll updates and offers date, hour/minute and quick-time controls. This source review does not certify clipping, focus, accessibility or drag behavior in a mounted browser.

Keyboard handlers cover arrows, T, N, Enter, slash and Escape, with a typing-target guard. They are installed on `window`; their presence alone does not prove arbitration among multiple open desktop windows.

## Personal-event HTTP contract

The parent desktop router mounts these routes under `/api/v1/desktop`. All use `require_oauth2_user`, the desktop owner resolver and `get_postgres_session`.

| Method and full path | Inputs | Success |
|---|---|---|
| `GET /api/v1/desktop/calendar/events` | Required datetime query aliases `from` and `to` | `200`, a plain array of event objects |
| `POST /api/v1/desktop/calendar/events` | JSON create body | `201`, one event object |
| `PATCH /api/v1/desktop/calendar/events/{event_id}` | UUID path id and JSON update body | `200`, the updated event object |
| `DELETE /api/v1/desktop/calendar/events/{event_id}` | UUID path id | `204`, empty body |

Create requires `title`, `starts_at` and `ends_at`; `notes` defaults to `""` and `all_day` to `false`. Update exposes the same fields, all optional and nullable. Omitted or null fields retain their stored values. Send `notes: ""` to clear notes. An empty update still validates the stored draft, updates `updated_at` and flushes; it is not a guaranteed no-op.

Response fields are `id`, `title`, `notes`, `starts_at`, `ends_at`, `all_day`, `created_at` and `updated_at`. Id is serialized as a string. All four datetime fields serialize as UTC with millisecond precision and `Z`, for example `2026-10-11T10:00:00.000Z`. The frontend maintains explicit [calendar DTOs/client methods](../../../shared/web/frontend/src/pages/Desktop/services/desktopApi/calendar.ts); this review does not claim generated-client or full OpenAPI-pilot coverage.

Policy trims title and notes, requires title length 1–200, limits notes to 4,000 characters and requires `ends_at > starts_at`. Aware input converts to UTC; naive datetime input is interpreted as UTC. Storage uses naive UTC. Browser editors serialize local civil choices to UTC instants. `all_day` is a display flag: the backend still requires a valid interval and does not enforce midnight alignment or a maximum event duration.

List uses the half-open overlap condition `starts_at < to AND ends_at > from`, ordered by start/id. It requires `from < to` and a duration of at most 93 days. There is no row cap, pagination or recurrence expansion in this route. An event spanning the requested boundary can therefore appear even if its start is outside the range.

Missing/foreign event ids return `404` with `detail: "Event not found"` for update/delete. Invalid typed input or malformed UUIDs use framework `422` validation. Policy violations use `422` with a human English `detail`, such as `Range must be at most 93 days`; internal policy codes are not emitted as a separate response field.

The desktop resolver first tries a UUID principal against `users.id`, then can resolve by OAuth email. A UUID with no matched row and no email is returned directly; an opaque id without email gets `400`, and an unsuccessful email lookup gets `404`. Authentication/status handling belongs to the shared OAuth layer, rather than a calendar-specific permission screen. The companion path has different identity behavior, described below.

Services filter every lookup by owner, add/delete through SQLAlchemy and flush. Transaction commit/rollback belongs to the database-session dependency after the route yields; its connection/pending-rollback branches are not replaced by a calendar transaction guarantee. There is no event revision/If-Match, deduplication key or calendar-specific quota in the reviewed CRUD path.

## Cache, loading and failures

[useDesktopCalendarEvents](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopCalendarEvents.ts) queries the selected range. Its create/update/delete mutations snapshot all personal-calendar range caches, apply optimistic changes, restore snapshots on error and invalidate the prefix on settlement. Create uses a temporary id and inserts optimistically into cached range arrays without an overlap filter; subsequent rendering/refetch reconciles these projections.

The window renders a personal-event loading skeleton, the grid/day agenda/editor and a generic failure banner. Error priority is personal load, then plan-overlay load, then mutation error. It does not implement the earlier target's distinct offline, forbidden-empty or permission state screens. Retry invalidates/refetches the relevant queries. Cached data may still exist while a request fails; failure is not proof that the server has no events.

Taskbar mini-calendar queries are enabled while the flyout is open and combine personal events with dated assistant-plan tasks. The selected-day preview shows up to four items and can open that day in CalendarApp. The helper discards query error states, so its empty preview cannot establish an empty server calendar. The today indicator also queries personal events and plans, but currently freezes its day/range at mount.

Confirmed cache/date/editor defects are recorded in the append-only [code-issue log](../../../docs/CODE_ISSUES.md): fixed 24-hour day membership across DST (`DOC-CODE-126`), stale mounted today/range (`127`), stale editor draft on event switch (`128`) and concurrent optimistic rollback removing another successful cache result (`129`). These are unresolved implementation limits, not recommended product behavior.

## Assistant-plan overlay and write-back

[Plan overlay projection](../../../shared/web/frontend/src/pages/Desktop/utils/companionPlanCalendarOverlay.ts) creates chips from pending/in-progress tasks with valid due dates, retaining task identity. Completed/cancelled tasks do not become editable overlay chips. Equal title/day does not merge two task ids or merge a plan step with a personal event.

Tasks with a due time render as timed slots; date-only tasks render all-day. Plan-chip save and drag use `PATCH /api/v1/ewa/companion-plans/tasks/{id}`. The editor's complete action sets task status to completed, rather than deleting a personal row. Duplicate creates a personal event. Successful plan writes dispatch plan invalidation; the rail's archive path currently omits it (`DOC-CODE-122`).

Plan nullable update semantics also differ from clearing a personal-event note: null task fields currently do not clear stored schedule/description (`DOC-CODE-117`), while `all_day: true` clears time/duration and retains date. See the [server-plan contract](../ewa/EWA-COMPANION-SERVER-PLANS-ADR.md) for flags, ownership, progress/FSM, persistence and the complete five-route plan API. This review does not accept every wallpaper/widget or general taskbar contract.

## Companion chat and prompt context

`calendar_v1` lists or creates personal events, independently of assistant-plan creation. Its own regex line gates remain authoritative: a recognized list question wins over a create match; an unmatched line returns no tool result even with bypass/title arguments. Plan-creation lines are excluded by the create gate. Successful creation writes immediately, with no Confirm client action.

The create parser requires a nonempty title and the first `HH:MM` or `HH.MM` fragment within 00:00–23:59. It accepts a title override; otherwise it strips recognized command/date/time fragments, and truncates the derived title to 200 characters. It recognizes an explicit `20xx-MM-DD` or tomorrow; other dates default to today. Invalid explicit ISO dates also currently fall back to today, and AM/PM suffixes are ignored (`DOC-CODE-123–124`). Use CalendarApp for precise date/time entry while these defects remain.

The parser creates one timed interval from the chosen local start to 60 civil minutes later, with empty notes and `all_day: false`; this handler does not consume requested duration/notes/all-day arguments. Its timezone is the operator wall-clock resolver: `ELITEEW_OPERATOR_TZ`, then `TZ`, then `Asia/Vladivostok`, with resolver fallback on an invalid zone. It does not use the browser or per-user timezone.

Companion identity conversion only parses `principal_id` as UUID. It does not perform REST's email fallback, so an opaque OAuth subject can use CalendarApp through email resolution yet receive unavailable calendar chat/prompt context (`DOC-CODE-125`). Pool/identity failure yields `unavailable`; caught list/create exceptions yield `error`. Missing title/time or a caught policy error yields `ok` with `needs_clarification: true`. Successful create returns `ok`, no actions and `data.event_id`/`created: true`.

Upcoming listing defaults to seven days from the current UTC instant and 12 rows; helper arguments clamp days to 1–31 and limit to 1–24. It includes overlapping ongoing events and excludes already-ended events, orders by start/id, and does not narrow the window based on a today/tomorrow phrase. Its successful nonempty tool data exposes event ids/titles, with an accompanying formatted digest.

Main reply preparation injects `User_calendar` alongside `Active_user_plan`. The prompt formatter bounds entries/title length, displays operator-local scheduling and omits notes. A read/identity/pool failure uses an explicit unread block; only a successful empty query produces empty-upcoming context. No general claim of reminders, recurrence, calendar synchronization or background notifications follows from this prompt injection.

## Verification and limits

The audit ran the existing backend policy/event/intent/prompt/tool suites: **23 passed**. Existing frontend event-policy/deep-link/formatting/mini-grid/CalendarApp/command-palette suites: **27 passed**. The read-only factory check, `bash scripts/eliteew/verify-app-factory.sh calendar`, passed UI, registry/catalog and manifest gates. That checker is structural/phrase-based, rather than a browser or persistence acceptance test.

An async in-process ASGI probe used async owner/session overrides, the actual routes/policy/SQLAlchemy services/serializer and a fake session. It exercised list/create/update/delete, the 93-day policy and missing-row handling, including `201`, `204` with no body and `.000Z` serialization. Separate real-function/fake-dependency probes confirmed chat date/time/identity defects, DST membership, frozen today range, draft retention and concurrent cache rollback. The first parser probe used a nonmatching phrase; the corrected recognized phrase with explicit title override is the accepted evidence. No database, external provider, broker, real OAuth flow or mounted browser was used. One Starlette deprecated-422-constant warning appeared.

The reviewed implementation has individual event intervals, without recurrence/CalDAV/Google synchronization. Remaining shell, install-profile, widget, native-client and infrastructure documents have independent audit scopes. Do not infer their acceptance from this calendar guide or its passing selected tests.

## Related documentation

- [Desktop documentation](README.md)
- [Widgets and assistant-plan agenda](DESKTOP-WIDGETS-AND-AGENDA.md)
- [Server plans and calendar projection](../ewa/EWA-COMPANION-SERVER-PLANS-ADR.md)
- [Companion tool/surface extension guide](../ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md)
- [Audit progress](../../../docs/DOCUMENTATION_PROGRESS.md) and [append-only code issues](../../../docs/CODE_ISSUES.md)
