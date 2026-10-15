/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fetch `GET /desktop/shell-bootstrap` once per auth session and hydrate React Query
 * + maintenance module cache so cold `#desktop` skips duplicate GETs.
 *
 * Invariants:
 * - Single-flight + session cache; logout clears via `clearDesktopShellBootstrapCache`.
 * - Cold callers on `#desktop` must `await ensureDesktopShellBootstrap()` before their own GETs
 *   (Auth / Preferences / NotificationCenter / Voice / DesktopWorkspace gate).
 * - Seeds existing query keys (profile, friends, gaf, ewdesk, ugs tray, installed)
 *   plus shell-state RAM/etag cache and items peek for desktop storage hydrate.
 * - Does not replace full App Store catalog GETs.
 *
 * Related:
 * - shared/api/routers/desktop_shell_bootstrap.py
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 */

import { friendsQueryKeys } from '@/features/friends/api/queryKeys';
import type { FriendsOverview } from '@/features/friends/types';
import { queryClient } from '@/providers/QueryProvider';
import { api } from '@/services/api/client';
import type { UgsTraySummaryResponse } from '@/services/api/ugs/dashboard';
import { UGS_DESKTOP_TRAY_TASKS_QUERY_KEY } from '@/services/api/ugsQueryOptions';
import {
	isDesktopBootLocation,
	readWindowBootLocation,
} from '@/services/boot/bootRoutePolicy';
import {
	publishMaintenanceStatus,
	type MaintenanceStatus,
} from '@/services/maintenance/maintenanceState';
import {
	PROFILE_ME_QUERY_KEY,
	PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
	PROFILE_PREFERENCES_QUERY_KEY,
	type NotificationCenterGetResponse,
} from '@/services/profileService';
import type { UserPreferences, UserProfileResponse } from '@/types/profile';
import { log } from '@/utils/logger';
import {
	EWDESK_NEWS_COUNTS_ROOT,
	EWDESK_NEWS_USER_STATE_ROOT,
} from '../components/ewDesk/ewDeskNewsQueryOptions';
import { gafChatQueryKeys } from '../components/GAFChat/api/gafChatApi';
import type { GAFChatListItem } from '../components/GAFChat/types';
import type { RecentFilesApiRow } from '../hooks/useRecentFiles';
import type {
	DesktopConfigResponse,
	DesktopItemResponse,
	DesktopShellState,
	InstalledResponse,
} from './desktopApi';
import { seedDesktopShellStateFromBootstrap } from './desktopApi/shellState';
import { updateDesktopConditionalCache } from './desktopConditionalGet';

const LOG = 'desktopShellBootstrap';
export const SHELL_BOOTSTRAP_DEADLINE_MS = 12_000;

export type DesktopShellBootstrapRecentFeed = {
	opened: RecentFilesApiRow[];
	added: RecentFilesApiRow[];
	generated: RecentFilesApiRow[];
	uploaded: RecentFilesApiRow[];
	projects: RecentFilesApiRow[];
};

export type DesktopShellBootstrapPayload = {
	schema_version: number;
	fetched_at: string;
	maintenance: MaintenanceStatus;
	profile: UserProfileResponse;
	preferences: UserPreferences;
	notification_center: NotificationCenterGetResponse;
	desktop_config: DesktopConfigResponse;
	installed: InstalledResponse;
	/** schema_version ≥2 — same shape as GET /desktop/shell-state */
	shell_state?: DesktopShellState;
	shell_state_etag?: string | null;
	shell_state_field_etags?: Record<string, string> | null;
	/** schema_version ≥2 — same shape as GET /desktop/items */
	items?: { items: DesktopItemResponse[] };
	recent_files: RecentFilesApiRow[];
	recent_content_feed: DesktopShellBootstrapRecentFeed;
	gaf_me: { user_id: string };
	gaf_chats: GAFChatListItem[] | null;
	friends_overview: FriendsOverview | null;
	ewdesk_news_counts: {
		unread_count: number;
		starred_count: number;
		pinned_count: number;
		total_published: number;
		latest_published_at: string | null;
	} | null;
	ewdesk_news_my_state: {
		read_post_ids: string[];
		starred_post_ids: string[];
		last_seen_published_at: string | null;
	} | null;
	ugs_tray_summary: UgsTraySummaryResponse | null;
};

let cache: DesktopShellBootstrapPayload | null = null;
let inflight: Promise<DesktopShellBootstrapPayload | null> | null = null;
/** Bumped on logout clear so a late in-flight GET cannot re-seed after clear. */
let bootstrapEpoch = 0;

export function peekDesktopShellBootstrap(): DesktopShellBootstrapPayload | null {
	return cache;
}

export function clearDesktopShellBootstrapCache(): void {
	bootstrapEpoch += 1;
	cache = null;
	inflight = null;
}

function seedQuery<T>(
	queryKey: readonly unknown[],
	data: T,
	updatedAt: number
): void {
	queryClient.setQueryData(queryKey, data, { updatedAt });
}

function hydrateFromBootstrap(payload: DesktopShellBootstrapPayload): void {
	// RQ freshness is client-local: use hydrate time, not server `fetched_at`
	// (clock skew / parse quirks must not mark bootstrap seeds immediately stale).
	const fetchedAt = Date.now();

	publishMaintenanceStatus(payload.maintenance);

	seedQuery(PROFILE_ME_QUERY_KEY, payload.profile, fetchedAt);
	seedQuery(PROFILE_PREFERENCES_QUERY_KEY, payload.preferences, fetchedAt);
	seedQuery(
		PROFILE_NOTIFICATION_CENTER_QUERY_KEY,
		payload.notification_center,
		fetchedAt
	);

	seedQuery(['desktop', 'installed'] as const, payload.installed, fetchedAt);
	updateDesktopConditionalCache('installed', payload.installed, null);
	updateDesktopConditionalCache('config', payload.desktop_config, null);

	if (payload.shell_state) {
		seedDesktopShellStateFromBootstrap(
			payload.shell_state,
			payload.shell_state_etag ?? null,
			payload.shell_state_field_etags ?? null
		);
	}

	if (payload.gaf_me?.user_id) {
		seedQuery(gafChatQueryKeys.me, payload.gaf_me, fetchedAt);
	}
	// Empty inbox is a valid seed — `if (gaf_chats)` would skip `[]` and force listChats GET.
	if (Array.isArray(payload.gaf_chats)) {
		seedQuery(gafChatQueryKeys.chats, payload.gaf_chats, fetchedAt);
	}
	if (payload.friends_overview != null) {
		seedQuery(friendsQueryKeys.overview(), payload.friends_overview, fetchedAt);
	}
	if (payload.ewdesk_news_counts) {
		seedQuery(EWDESK_NEWS_COUNTS_ROOT, payload.ewdesk_news_counts, fetchedAt);
	}
	if (payload.ewdesk_news_my_state) {
		seedQuery(
			EWDESK_NEWS_USER_STATE_ROOT,
			payload.ewdesk_news_my_state,
			fetchedAt
		);
	}
	if (payload.ugs_tray_summary) {
		seedQuery(
			UGS_DESKTOP_TRAY_TASKS_QUERY_KEY,
			payload.ugs_tray_summary,
			fetchedAt
		);
	}
}

async function fetchBootstrap(): Promise<DesktopShellBootstrapPayload> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => {
		controller.abort();
	}, SHELL_BOOTSTRAP_DEADLINE_MS);
	try {
		const data = await api.get<DesktopShellBootstrapPayload>(
			'/desktop/shell-bootstrap',
			{
				baseURL: '/api/v1',
				timeout: SHELL_BOOTSTRAP_DEADLINE_MS,
				signal: controller.signal,
				headers: {
					'Cache-Control': 'no-store',
					Pragma: 'no-cache',
				},
			}
		);
		return data;
	} finally {
		window.clearTimeout(timer);
	}
}

/**
 * Ensure shell bootstrap is loaded and hydrated. Safe to call from Auth + App.
 * Non-desktop routes return null without network (profile cluster keeps per-endpoint GETs).
 *
 * Callers on `#desktop` must await this before issuing their own cold GETs so hydrate
 * wins the race (single-flight shared across Auth / Preferences / Notification / shell).
 */
export async function ensureDesktopShellBootstrap(options?: {
	forceDesktop?: boolean;
}): Promise<DesktopShellBootstrapPayload | null> {
	const forceDesktop = options?.forceDesktop === true;
	if (
		!forceDesktop &&
		(typeof window === 'undefined' ||
			!isDesktopBootLocation(readWindowBootLocation()))
	) {
		return cache;
	}
	if (cache) {
		return cache;
	}
	if (inflight) {
		return inflight;
	}
	const epochAtStart = bootstrapEpoch;
	const flightRef: {
		current: Promise<DesktopShellBootstrapPayload | null> | undefined;
	} = { current: undefined };
	flightRef.current = (async () => {
		try {
			const payload = await fetchBootstrap();
			if (epochAtStart !== bootstrapEpoch) {
				log.info(
					LOG,
					'shell-bootstrap discarded — cache cleared during flight'
				);
				return null;
			}
			cache = payload;
			hydrateFromBootstrap(payload);
			log.info(LOG, 'shell-bootstrap hydrated', {
				schema_version: payload.schema_version,
			});
			return payload;
		} catch (e) {
			const err = e instanceof Error ? e : undefined;
			// Follower tabs intentionally cancel bootstrap; do not alarm as a shell failure.
			if (err?.message === 'follower_tab_passive_mode') {
				log.info(LOG, 'shell-bootstrap skipped — follower_tab_passive_mode');
				return null;
			}
			log.warn(
				LOG,
				'shell-bootstrap failed — falling back to per-endpoint cold GETs',
				err
			);
			return null;
		} finally {
			if (inflight === flightRef.current) {
				inflight = null;
			}
		}
	})();
	const pendingTask = flightRef.current;
	inflight = pendingTask;
	return pendingTask;
}

/** True when `#desktop` (or force) — cold path should await bootstrap before GETs. */
export function shouldAwaitDesktopShellBootstrap(
	forceDesktop = false
): boolean {
	return (
		forceDesktop ||
		(typeof window !== 'undefined' &&
			isDesktopBootLocation(readWindowBootLocation()))
	);
}

/** Test helper: seed cache without HTTP. */
export function __setDesktopShellBootstrapForTests(
	payload: DesktopShellBootstrapPayload | null
): void {
	cache = payload;
	inflight = null;
	if (payload) {
		hydrateFromBootstrap(payload);
	}
}
