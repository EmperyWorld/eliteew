/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P1 bridge: auto-flush shell command journal (windows / virtualDesktops) when
 * online; surface flush failures without clearing journal on network error.
 *
 * Invariants:
 * - Flush only when subject + online.
 * - Clear journal ops only via flushShellCommandJournal success path.
 * - Auto-flush once per online subject session (mirror widget outbox / persist queue).
 *
 * Related:
 * - utils/desktopShellCommandJournal.ts
 * - utils/desktopShellStateMutationPipeline.ts
 */

import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { CoalescedDesktopShellStatePatch } from '../types/desktopShellStatePatch.types';
import {
	flushShellCommandJournal,
	getShellCommandJournalCount,
	getShellCommandJournalCountSync,
	subscribeShellCommandJournal,
	type ShellCommandJournalDomain,
} from '../utils/desktopShellCommandJournal';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
} from '../utils/desktopShellStateMutationPipeline';

export function useDesktopShellCommandJournalFlush(params: {
	persistSubjectKey: string | null;
	isOnline: boolean;
}) {
	const { persistSubjectKey, isOnline } = params;
	const [shellJournalFlushFailed, setShellJournalFlushFailed] = React.useState<
		string | null
	>(null);
	const [shellJournalFlushing, setShellJournalFlushing] = React.useState(false);
	const [shellJournalPendingCount, setShellJournalPendingCount] =
		React.useState(0);
	const autoFlushedSubjectRef = React.useRef<string | null>(null);

	const syncCountFromStore = React.useCallback(() => {
		return getShellCommandJournalCountSync(persistSubjectKey);
	}, [persistSubjectKey]);

	const storeCount = useSyncExternalStore(
		subscribeShellCommandJournal,
		syncCountFromStore,
		() => 0
	);

	React.useEffect(() => {
		setShellJournalPendingCount(storeCount);
		if (!persistSubjectKey) return;
		void getShellCommandJournalCount(persistSubjectKey).then((total) => {
			setShellJournalPendingCount(total);
		});
	}, [persistSubjectKey, storeCount]);

	const flushShellJournal = React.useCallback(async (): Promise<boolean> => {
		if (!persistSubjectKey || !isOnline) return false;
		setShellJournalFlushing(true);
		try {
			const { ok, error } = await flushShellCommandJournal({
				subject: persistSubjectKey,
				patchShell: async (domain: ShellCommandJournalDomain, patch) => {
					const source: 'windows' | 'virtualDesktops' =
						domain === 'windows' ? 'windows' : 'virtualDesktops';
					scheduleShellStateMutation({
						source,
						merge: () => patch as CoalescedDesktopShellStatePatch,
						immediate: true,
					});
					await flushShellStatePipelineNow(source);
				},
			});
			const remaining = await getShellCommandJournalCount(persistSubjectKey);
			setShellJournalPendingCount(remaining);
			if (!ok) {
				setShellJournalFlushFailed(error ?? 'shell journal flush failed');
				return false;
			}
			setShellJournalFlushFailed(null);
			return true;
		} finally {
			setShellJournalFlushing(false);
		}
	}, [isOnline, persistSubjectKey]);

	const flushShellJournalRef = React.useRef(flushShellJournal);
	flushShellJournalRef.current = flushShellJournal;

	React.useEffect(() => {
		if (!isOnline) {
			autoFlushedSubjectRef.current = null;
			return;
		}
		if (!persistSubjectKey) return;
		if (autoFlushedSubjectRef.current === persistSubjectKey) return;
		autoFlushedSubjectRef.current = persistSubjectKey;
		void flushShellJournalRef.current();
	}, [isOnline, persistSubjectKey]);

	return {
		shellJournalPendingCount,
		shellJournalFlushFailed,
		shellJournalFlushing,
		flushShellJournal,
	};
}
