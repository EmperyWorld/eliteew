/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-state hydration and persist for floating widget timezone and quiet mode.
 *
 * Invariants:
 * - Pending patches flush after shell hydrate; legacy localStorage keys migrate once.
 *
 * Related:
 * - services/desktopApi.ts
 * - utils/desktopShellStateMutationPipeline.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDesktopShellStateDeduplicated } from '../../services/desktopApi';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
	waitForShellStatePipelineFlush,
} from '../../utils/desktopShellStateMutationPipeline';

export interface UseFloatingWidgetShellPrefsResult {
	timezone: string;
	setTimezone: (value: string) => void;
	isQuietMode: boolean;
	setIsQuietMode: React.Dispatch<React.SetStateAction<boolean>>;
	scheduleWidgetShellPersist: (partial: {
		timezone?: string;
		quiet_mode?: boolean;
	}) => void;
}

export function useFloatingWidgetShellPrefs(
	userId: string
): UseFloatingWidgetShellPrefsResult {
	const widgetShellHydratedRef = useRef(false);
	const pendingShellWidgetPatchRef = useRef<{
		timezone?: string;
		quiet_mode?: boolean;
	} | null>(null);

	const [timezone, setTimezone] = useState<string>(() => {
		try {
			return (
				Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'
			);
		} catch {
			return 'Europe/Moscow';
		}
	});

	const [isQuietMode, setIsQuietMode] = useState<boolean>(false);

	const scheduleWidgetShellPersist = useCallback(
		(partial: { timezone?: string; quiet_mode?: boolean }) => {
			if (!widgetShellHydratedRef.current) {
				pendingShellWidgetPatchRef.current = {
					...pendingShellWidgetPatchRef.current,
					...partial,
				};
				return;
			}
			scheduleShellStateMutation({
				source: 'chrome',
				merge: () => partial,
			});
			void waitForShellStatePipelineFlush().catch(() => {});
		},
		[]
	);

	const flushPendingWidgetShellPatch = useCallback(() => {
		const p = pendingShellWidgetPatchRef.current;
		pendingShellWidgetPatchRef.current = null;
		if (!p) return;
		const body: { timezone?: string; quiet_mode?: boolean } = {};
		if (p.timezone !== undefined) body.timezone = p.timezone;
		if (p.quiet_mode !== undefined) body.quiet_mode = p.quiet_mode;
		if (Object.keys(body).length === 0) return;
		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => body,
			immediate: true,
		});
		void flushShellStatePipelineNow('chrome').catch(() => {});
	}, []);

	useEffect(() => {
		widgetShellHydratedRef.current = false;
		let cancelled = false;
		void (async () => {
			try {
				const s = await fetchDesktopShellStateDeduplicated();
				if (cancelled) return;
				const toPatch: { timezone?: string; quiet_mode?: boolean } = {};
				if (s.timezone?.trim()) {
					setTimezone(s.timezone.trim());
				} else {
					let leg = '';
					try {
						leg =
							window.localStorage
								.getItem(`desktop_timezone::${userId}`)
								?.trim() ?? '';
					} catch {
						/* ignore */
					}
					if (leg) {
						setTimezone(leg);
						toPatch.timezone = leg;
					}
				}
				if (typeof s.quiet_mode === 'boolean') {
					setIsQuietMode(s.quiet_mode);
				} else {
					let q = false;
					try {
						q =
							window.localStorage.getItem(`desktop_quiet_mode::${userId}`) ===
							'1';
					} catch {
						/* ignore */
					}
					setIsQuietMode(q);
					if (q) toPatch.quiet_mode = true;
				}
				try {
					window.localStorage.removeItem(`desktop_timezone::${userId}`);
					window.localStorage.removeItem(`desktop_quiet_mode::${userId}`);
				} catch {
					/* ignore */
				}
				if (Object.keys(toPatch).length > 0) {
					scheduleShellStateMutation({
						source: 'chrome',
						merge: () => toPatch,
						immediate: true,
					});
					await flushShellStatePipelineNow('chrome').catch(() => {});
				}
			} catch {
				/* offline: keep browser defaults */
			} finally {
				if (!cancelled) {
					widgetShellHydratedRef.current = true;
					flushPendingWidgetShellPatch();
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, flushPendingWidgetShellPatch]);

	return {
		timezone,
		setTimezone,
		isQuietMode,
		setIsQuietMode,
		scheduleWidgetShellPersist,
	};
}
