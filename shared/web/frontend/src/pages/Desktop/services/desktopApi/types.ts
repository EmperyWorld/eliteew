/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OpenAPI-derived desktop API types and shell_state record shapes for the user desktop client.
 *
 * Invariants:
 * - Schema aliases track `components['schemas']` from `@/generated/desktop-openapi`.
 *
 * Related:
 * - `types/desktopShellStatePatch.types.ts`
 * - `openapi/pilot/desktop.openapi.json`
 */

import type { components } from '@/generated/desktop-openapi';

type Schema = components['schemas'];

export type Position = Schema['Position'];
export type IconSize = Schema['IconSize'];
export type Theme = Schema['Theme'];
export type ItemType = Schema['ItemType'];

/** Backend string token (e.g. top-right); see OpenAPI `DesktopConfigResponse`. */
export type WidgetsPanelPosition =
	Schema['DesktopConfigResponse']['widgets_panel_position'];

export type DesktopConfigResponse = Schema['DesktopConfigResponse'];
export type DesktopConfigUpdate = Schema['DesktopConfigUpdate'];
export type DesktopItemResponse = Schema['DesktopItemResponse'];
export type DesktopItemCreate = Schema['DesktopItemCreate'];

/** Clipboard row in shell_state (`timestamp` is ISO string from API). */
export interface DesktopClipboardShellRecord {
	id: string;
	type: 'text' | 'image' | 'html';
	content: string;
	preview?: string;
	timestamp: string;
	pinned: boolean;
	source?: string;
}

/** Desktop music resume state in shell_state (snake_case in API JSON). */
export interface DesktopNowPlayingShellState {
	track: {
		id: string;
		name: string;
		thumbnail_url?: string | null;
		version?: string | null;
	} | null;
	current_time: number;
	volume: number;
}

/** Music playback mode + queue persisted separately from `now_playing` transport state. */
export interface DesktopMusicPlaybackShellState {
	playback_rate?: number;
	shuffle?: boolean;
	repeat?: 'none' | 'all' | 'one';
	queue?: Array<{
		id: string;
		name: string;
		thumbnail_url?: string | null;
		version?: string | null;
	}>;
}

/** Music player playlists in shell_state (snake_case in API JSON). */
export interface MusicPlaylistShellRow {
	id: string;
	name: string;
	track_ids: string[];
}

export type DesktopShellState = Schema['DesktopShellStateOut'] & {
	music_playback?: DesktopMusicPlaybackShellState | null;
};
export type DesktopShellStatePatch = Schema['DesktopShellStatePatch'] & {
	music_playback?: DesktopMusicPlaybackShellState | null;
};

export type {
	CoalescedDesktopShellStatePatch,
	ExpansionShellSlicePatch,
	ExpansionShellState,
	ExpansionShellStatePatch,
	EXPANSION_SHELL_STATE_PATCH_KEYS,
} from '../../types/desktopShellStatePatch.types';

export type DesktopShellStateHttpResult = {
	state: DesktopShellState;
	etag: string | null;
	fieldEtags: Record<string, string> | null;
};

export type PatchDesktopShellStateOptions = {
	ifMatch?: string | null;
	/** Optional; when set, server Redis-replays safe retries (P2). */
	idempotencyKey?: string | null;
};

/** @deprecated Use `DesktopAccessGroupRef` naming from OpenAPI; kept as alias. */
export type StoreAccessGroupRef = Schema['DesktopAccessGroupRef'];

export type StoreAppResponse = Schema['StoreAppResponse'];
export type StoreAppDetailResponse = Schema['StoreAppDetailResponse'];
export type EwWalletResponse = Schema['EwWalletResponse'];
export type StoreResponse = Schema['StoreResponse'];
export type InstalledResponse = Schema['InstalledResponse'];

export type WidgetNoteResponse = Schema['WidgetNoteResponse'];
export type WidgetTodoResponse = Schema['WidgetTodoResponse'];

export type DashboardFavoriteResponse = Schema['DashboardFavoriteResponse'];
export type DashboardFavoriteCreate = Schema['DashboardFavoriteCreate'];

export type DesktopWidgetSyncOpKind =
	| 'note_create'
	| 'note_update'
	| 'note_delete'
	| 'todo_create'
	| 'todo_update'
	| 'todo_delete'
	| 'favorite_create'
	| 'favorite_delete'
	| 'favorite_reorder';

export type DesktopWidgetSyncOp = {
	op_id: string;
	kind: DesktopWidgetSyncOpKind;
	client_id?: string | null;
	server_id?: string | null;
	ts?: string | null;
	payload?: Record<string, unknown>;
};

export type DesktopWidgetSyncOpResult = {
	op_id: string;
	status: 'applied' | 'skipped_lww' | 'noop' | 'error';
	server_id?: string | null;
	detail?: string | null;
};

export type DesktopWidgetSyncResponse = {
	results: DesktopWidgetSyncOpResult[];
};

/** GET /desktop/install-profile — active edition pack for catalog enablement. */
export type DesktopInstallProfileResponse = {
	schema_version: number;
	edition: 'cloud' | 'onprem' | 'client' | string;
	profile_id: string;
	mode: string;
	access_mode: 'community' | 'managed' | string;
	seat_activation_required: boolean;
	include_legacy: boolean;
	enabled_app_components: string[];
	ai_provider?: string | null;
	ai_providers_allowlist?: string[];
	ai_eliteew_configured?: boolean | null;
	ai_local_configured?: boolean | null;
	ai_third_party_configured?: boolean | null;
	ai_active_configured?: boolean | null;
};

/** GET/POST /desktop/calendar/events — until next OpenAPI pilot refresh. */
export type DesktopCalendarEventResponse = {
	id: string;
	title: string;
	notes: string;
	starts_at: string;
	ends_at: string;
	all_day: boolean;
	created_at: string;
	updated_at: string;
};

export type DesktopCalendarEventWrite = {
	title: string;
	notes?: string;
	starts_at: string;
	ends_at: string;
	all_day?: boolean;
};
