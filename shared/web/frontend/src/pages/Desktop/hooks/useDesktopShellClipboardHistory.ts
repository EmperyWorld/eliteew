/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace-level clipboard history engine: hydrate, background OS capture, shell_state persist.
 *
 * Related:
 * - context/DesktopClipboardHistoryProvider.tsx
 * - components/ClipboardManager.tsx
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DESKTOP_POLLING } from '../constants';
import {
	fetchDesktopShellStateDeduplicated,
	isDesktopShellStateConflictError,
} from '../services/desktopApi';
import { enqueueDesktopPersistShellPatch } from '../utils/desktopPersistPatchQueue';
import { subscribeDesktopClipboardCapture } from '../utils/desktopClipboardCaptureBus';
import {
	type ClipboardHistoryCaptureInput,
	mergeClipboardHistoryCapture,
	toggleClipboardHistoryPin,
} from '../utils/desktopClipboardHistoryCore';
import {
	allowsOsClipboardPoll,
	allowsShellStateClipboardSync,
	type ClipboardPolicyMode,
	readClipboardPolicyMode,
	writeClipboardPolicyMode,
} from '../utils/clipboardPolicy';
import {
	clipboardItemsToShellRecords,
	shellRecordsToClipboardItems,
	type DesktopClipboardHistoryItem,
} from '../utils/clipboardHistoryPersistence';
import { readOsClipboardForHistory } from '../utils/desktopClipboardOsCapture';
import { subscribeDocumentVisibleSync } from '../utils/subscribeDocumentVisibleSync';
import {
	flushShellStatePipelineNow,
	scheduleShellStateMutation,
} from '../utils/desktopShellStateMutationPipeline';

const LEGACY_STORAGE_KEY = 'desktop-clipboard-history';
const CLIPBOARD_PERSIST_DEBOUNCE_MS = 600;

export type DesktopShellClipboardHistoryEngine = {
	history: DesktopClipboardHistoryItem[];
	shellHydrated: boolean;
	policyMode: ClipboardPolicyMode;
	captureFromOs: () => Promise<void>;
	captureItem: (input: ClipboardHistoryCaptureInput) => void;
	setPolicyMode: (mode: ClipboardPolicyMode) => void;
	togglePin: (id: string) => void;
	deleteItem: (id: string) => void;
	clearHistory: () => void;
};

export function useDesktopShellClipboardHistory(
	persistSubjectKey?: string | null
): DesktopShellClipboardHistoryEngine {
	const [history, setHistory] = useState<DesktopClipboardHistoryItem[]>([]);
	const [shellHydrated, setShellHydrated] = useState(false);
	const [policyMode, setPolicyModeState] = useState<ClipboardPolicyMode>(() =>
		readClipboardPolicyMode()
	);
	const lastOsContentRef = useRef<string | null>(null);
	const lastPersistJsonRef = useRef<string | null>(null);

	const captureItem = useCallback((input: ClipboardHistoryCaptureInput) => {
		setHistory((prev) => mergeClipboardHistoryCapture(prev, input));
	}, []);

	const captureFromOs = useCallback(async () => {
		if (!allowsOsClipboardPoll(policyMode)) {
			return;
		}
		const captured = await readOsClipboardForHistory();
		if (!captured?.content?.trim()) {
			return;
		}
		if (lastOsContentRef.current === captured.content) {
			return;
		}
		lastOsContentRef.current = captured.content;
		captureItem(captured);
	}, [captureItem, policyMode]);

	useEffect(() => {
		let cancelled = false;
		const loadLegacyLocal = (): void => {
			try {
				const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
				if (!raw) return;
				const parsed = JSON.parse(raw) as DesktopClipboardHistoryItem[];
				setHistory(
					parsed.map((item) => ({
						...item,
						timestamp: new Date(item.timestamp),
					}))
				);
			} catch {
				/* invalid legacy */
			}
		};

		void (async () => {
			try {
				if (!allowsShellStateClipboardSync(readClipboardPolicyMode())) {
					loadLegacyLocal();
					return;
				}
				const shell = await fetchDesktopShellStateDeduplicated();
				if (cancelled) return;
				const rows = shell.clipboard_history;
				if (Array.isArray(rows) && rows.length > 0) {
					setHistory(shellRecordsToClipboardItems(rows));
				} else {
					const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
					if (raw) {
						try {
							const parsed = JSON.parse(raw) as DesktopClipboardHistoryItem[];
							const normalized = parsed.map((item) => ({
								...item,
								timestamp: new Date(item.timestamp),
							}));
							if (normalized.length > 0) {
								setHistory(normalized);
								scheduleShellStateMutation({
									source: 'clipboard',
									merge: () => ({
										clipboard_history: clipboardItemsToShellRecords(normalized),
									}),
									immediate: true,
								});
								await flushShellStatePipelineNow('clipboard').catch(() => {});
							}
						} catch {
							/* ignore */
						}
					}
				}
				try {
					localStorage.removeItem(LEGACY_STORAGE_KEY);
				} catch {
					/* ignore */
				}
			} catch {
				if (!cancelled) loadLegacyLocal();
			} finally {
				if (!cancelled) setShellHydrated(true);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		return subscribeDesktopClipboardCapture((input) => {
			captureItem(input);
		});
	}, [captureItem]);

	useEffect(() => {
		if (!shellHydrated || !allowsShellStateClipboardSync(policyMode)) {
			return;
		}
		const records = clipboardItemsToShellRecords(history);
		const payloadJson = JSON.stringify(records);
		if (payloadJson === lastPersistJsonRef.current) {
			return;
		}
		const timer = setTimeout(() => {
			lastPersistJsonRef.current = payloadJson;
			scheduleShellStateMutation({
				source: 'clipboard',
				merge: () => ({ clipboard_history: records }),
				debounceMs: CLIPBOARD_PERSIST_DEBOUNCE_MS,
			});
		}, CLIPBOARD_PERSIST_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [history, shellHydrated, policyMode]);

	useEffect(() => {
		if (!allowsOsClipboardPoll(policyMode)) {
			return;
		}
		void captureFromOs();
		const interval = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			void captureFromOs();
		}, DESKTOP_POLLING.CLIPBOARD_MS);
		const unsubVisible = subscribeDocumentVisibleSync(() => {
			void captureFromOs();
		});
		return () => {
			clearInterval(interval);
			unsubVisible();
		};
	}, [captureFromOs, policyMode]);

	useEffect(() => {
		const onPageHide = (): void => {
			if (!shellHydrated || !allowsShellStateClipboardSync(policyMode)) {
				return;
			}
			const records = clipboardItemsToShellRecords(history);
			scheduleShellStateMutation({
				source: 'clipboard',
				merge: () => ({ clipboard_history: records }),
				immediate: true,
			});
			if (persistSubjectKey) {
				void flushShellStatePipelineNow('clipboard').catch((error) => {
					if (isDesktopShellStateConflictError(error)) return;
					enqueueDesktopPersistShellPatch(persistSubjectKey, {
						clipboard_history: records,
					});
				});
			}
		};
		window.addEventListener('pagehide', onPageHide);
		return () => window.removeEventListener('pagehide', onPageHide);
	}, [history, persistSubjectKey, policyMode, shellHydrated]);

	const setPolicyMode = useCallback((next: ClipboardPolicyMode) => {
		writeClipboardPolicyMode(next);
		setPolicyModeState(next);
		if (next === 'quarantine') {
			scheduleShellStateMutation({
				source: 'clipboard',
				merge: () => ({ clipboard_history: [] }),
				immediate: true,
			});
			void flushShellStatePipelineNow('clipboard').catch(() => {});
			lastPersistJsonRef.current = JSON.stringify([]);
		}
	}, []);

	const togglePin = useCallback((id: string) => {
		setHistory((prev) => toggleClipboardHistoryPin(prev, id));
	}, []);

	const deleteItem = useCallback((id: string) => {
		setHistory((prev) => prev.filter((item) => item.id !== id));
	}, []);

	const clearHistory = useCallback(() => {
		setHistory((prev) => prev.filter((item) => item.pinned));
	}, []);

	return {
		history,
		shellHydrated,
		policyMode,
		captureFromOs,
		captureItem,
		setPolicyMode,
		togglePin,
		deleteItem,
		clearHistory,
	};
}
