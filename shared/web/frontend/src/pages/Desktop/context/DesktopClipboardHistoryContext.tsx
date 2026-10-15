/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context for desktop clipboard history (single workspace source of truth).
 *
 * Related:
 * - hooks/useDesktopShellClipboardHistory.ts
 * - components/ClipboardManager.tsx
 */

import * as React from 'react';
import {
	useDesktopShellClipboardHistory,
	type DesktopShellClipboardHistoryEngine,
} from '../hooks/useDesktopShellClipboardHistory';

const DesktopClipboardHistoryContext =
	React.createContext<DesktopShellClipboardHistoryEngine | null>(null);

export function DesktopClipboardHistoryProvider({
	persistSubjectKey,
	children,
}: {
	persistSubjectKey?: string | null;
	children: React.ReactNode;
}): React.JSX.Element {
	const engine = useDesktopShellClipboardHistory(persistSubjectKey);
	return (
		<DesktopClipboardHistoryContext.Provider value={engine}>
			{children}
		</DesktopClipboardHistoryContext.Provider>
	);
}

export function useDesktopClipboardHistory(): DesktopShellClipboardHistoryEngine {
	const ctx = React.useContext(DesktopClipboardHistoryContext);
	if (!ctx) {
		throw new Error(
			'useDesktopClipboardHistory must be used within DesktopClipboardHistoryProvider'
		);
	}
	return ctx;
}

export function useDesktopClipboardHistoryOptional():
	| DesktopShellClipboardHistoryEngine
	| null {
	return React.useContext(DesktopClipboardHistoryContext);
}
