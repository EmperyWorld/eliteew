# EWA desktop applications, drivers and chat actions

Reference · checked against source on 2026-10-11. Domain-driver ids, shell intents and companion chat actions are three different interfaces. Declaring an application in the catalog does not establish a driver for that application.

## Domain ports

[The driver registry](../drivers/registry.py) reserves `eliteew_desktop`, `ugs_control`, `documents_workspace`, `content_manager` and `ewa_companion_ambient`. The older `eliteew_ugs` label in this document was incorrect: the UGS HTTP adapter reports `ugs_control`. [Runtime composition](../desktop/runtime.py) constructs shell/hint ports directly, rather than resolving every app through this registry.

The shell HTTP adapter executes shell/config patches only. UGS alignment and document/content shell hints are read-only. The full protocol/adapter/configuration map is [DRIVERS-ROADMAP.md](DRIVERS-ROADMAP.md); future application protocols need explicit implementation and policy rather than a new row in this catalog.

## Companion action parser

[actions/allowlist.py](../companion/actions/allowlist.py) accepts model JSON `actions` or `<<ACTIONS>>[...]<<END>>` tails. [ux/reply_extract.py](../companion/ux/reply_extract.py) combines normalized JSON/tail actions and removes private control material from visible replies. Parser cap: three actions per turn.

Accepted model action types are `open_app`, `focus_app`, `minimize_app`, `close_app`, `patch_desktop_config`, `ambient_adjust` and `music_play_track`. `ALLOWED_APP_COMPONENTS` is the explicit server list; `UnifiedAdminApp` and `DesktopAppMaintenance` are excluded. It is a maintained list, not an automatically synchronized import of the SPA catalog. Unknown/malformed entries are dropped. A parsed opaque content id is not by itself proof of object access.

`open_app` normalizes optional fields by component: DocEditor content id; ContentManager focus id/search filter/folder id; EWRP/Presentations job id. Search text is bounded to 500 characters and opaque ids to 128. The source list and parser are authoritative for exact additions; do not copy historical `api/services/ewa_companion/actions.py` paths.

## Execution and client outcomes

[desktop_config_execute.py](../companion/ux/desktop_config_execute.py) executes config patches on the API server through policy, sanitizer and bearer self-HTTP, then removes those rows from the outbound client list. Missing bearer/policy/HTTP failures do not become successful browser config updates. [ambient.py](../companion/actions/ambient.py) expands enabled ambient presets into existing config/open actions; with `EWA_COMPANION_AMBIENT_ACTIONS_ENABLED` off it strips ambient rows.

[useCompanionActionDispatch](../../../web/frontend/src/features/ewa/companionUx/useCompanionActionDispatch.ts) handles the client channel:

- Open/focus/minimize/close call desktop deep-link helpers. Focus/minimize/close target the newest window of the component, not a stable orchestration `window_id`.
- `open_app` for DocEditor with a content id normally opens the companion's embedded document surface. A desktop window is requested only when `open_on_desk` is true or the embedded-only conditions do not apply. It no longer always opens a separate desktop window.
- Server tool results can also contain `doc_editor_set_body`/notice fields that are not part of the model allowlist. Do not conflate all output actions with model-parsed actions.
- `music_play_track` dispatches global playback through [companionActionDispatch.ts](../../../web/frontend/src/features/ewa/companionActionDispatch.ts), with a content-library refresh. Blocked/failed outcomes do not dispatch side effects.
- Blocked/failed window/document actions become notices. The tray keeps the latest three records; this is separate from the parser's cap.

Undo is a UI heuristic: open closes the newest matching window; close requests an app reopen; focus requests minimize; minimize requests focus. Reopen only restores optional fields actually saved in the record, so the exact prior window/content/session is not guaranteed. Notice/outcome-badged records are dismissed rather than reversed. Embedded-only opens do not imply a desktop window exists to close.

[Shell context](../companion/sidecar/shell_context.py) gives bounded request metadata/excerpts/listings to companion turns. It is not the desktop domain driver and does not grant file access. The profile influences model context/persona; driver policy and downstream content authorization still govern execution.

Related: [desktop HTTP contract](DESKTOP-ORCHESTRATION.md), [policy flow](POLICY-LLM-MATRIX.md), [document/shell context](../../../../documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md), [extension guide](../../../../documentation/product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md).
