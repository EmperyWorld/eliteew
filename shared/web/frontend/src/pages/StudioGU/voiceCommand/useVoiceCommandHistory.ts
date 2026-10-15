/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Device-local command history for Voice Command Center: load/save via localStorage only.
 *
 * Invariants:
 * - `isLocalOnly` is always true — no cloud sync API for VCC history (see DESKTOP-IMPLEMENTED-VS-STUB.md).
 * - Persisted list capped at `MAX_PERSISTED_HISTORY`.
 *
 * Related:
 * - `storage.ts`, `VoiceCommandCenter.tsx`, `CommandHistoryPanel.tsx`
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandHistoryItem } from './components/CommandHistoryPanel';
import {
	clearPersistedHistory,
	loadPersistedHistory,
	savePersistedHistory,
	VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY,
} from './storage';
import { MAX_PERSISTED_HISTORY } from './types';

export function useVoiceCommandHistory() {
	const [commandHistory, setCommandHistory] =
		useState<CommandHistoryItem[]>(loadPersistedHistory);
	const [historySaveFailed, setHistorySaveFailed] = useState(false);
	const saveFailureNotifiedRef = useRef(false);

	useEffect(() => {
		if (commandHistory.length === 0) return;
		const ok = savePersistedHistory(commandHistory);
		if (!ok) {
			setHistorySaveFailed(true);
		}
	}, [commandHistory]);

	const prependCommandHistoryItem = useCallback((item: CommandHistoryItem) => {
		setCommandHistory((prev) =>
			[item, ...prev].slice(0, MAX_PERSISTED_HISTORY)
		);
	}, []);

	const clearCommandHistory = useCallback(() => {
		setCommandHistory([]);
		clearPersistedHistory();
	}, []);

	const acknowledgeHistorySaveFailure = useCallback(() => {
		saveFailureNotifiedRef.current = true;
		setHistorySaveFailed(false);
	}, []);

	const shouldNotifyHistorySaveFailure =
		historySaveFailed && !saveFailureNotifiedRef.current;

	return {
		commandHistory,
		setCommandHistory,
		prependCommandHistoryItem,
		clearCommandHistory,
		isLocalOnly: VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY,
		historySaveFailed: shouldNotifyHistorySaveFailure,
		acknowledgeHistorySaveFailure,
	} as const;
}
