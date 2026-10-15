/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App-wide write-path bus: successful in-app copies notify desktop clipboard history.
 *
 * Related:
 * - utils/clipboard.ts
 * - hooks/useDesktopShellClipboardHistory.ts
 */

import type { ClipboardHistoryCaptureInput } from './desktopClipboardHistoryCore';

type ClipboardCaptureListener = (input: ClipboardHistoryCaptureInput) => void;

const listeners = new Set<ClipboardCaptureListener>();

export function subscribeDesktopClipboardCapture(
	listener: ClipboardCaptureListener
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function notifyDesktopClipboardCapture(
	input: ClipboardHistoryCaptureInput
): void {
	for (const listener of listeners) {
		try {
			listener(input);
		} catch {
			/* listener must not break publisher */
		}
	}
}
