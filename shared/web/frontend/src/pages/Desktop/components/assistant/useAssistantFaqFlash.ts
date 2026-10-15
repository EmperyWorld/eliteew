/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ panel and chat transient flash state with auto-clear timeouts.
 *
 * Invariants:
 * - Falsy flash values skip the timer (via useAssistantFlashTimeout).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - useAssistantFlashTimeout.ts
 */
import * as React from 'react';
import { useAssistantFlashTimeout } from './useAssistantFlashTimeout';

export function useAssistantFaqFlash() {
	const [faqRefreshFlash, setFaqRefreshFlash] = React.useState(false);
	const [faqSearchFocusFlash, setFaqSearchFocusFlash] = React.useState(false);
	const [clearLocalFaqFlash, setClearLocalFaqFlash] = React.useState(false);
	const [faqInsertFlashId, setFaqInsertFlashId] = React.useState<string | null>(
		null
	);
	const [faqShowFlashId, setFaqShowFlashId] = React.useState<string | null>(
		null
	);
	const [faqAskFlashId, setFaqAskFlashId] = React.useState<string | null>(null);
	const [faqBulkActionFlash, setFaqBulkActionFlash] = React.useState<
		'expand' | 'collapse' | null
	>(null);

	useAssistantFlashTimeout(faqRefreshFlash, () => setFaqRefreshFlash(false));
	useAssistantFlashTimeout(faqSearchFocusFlash, () =>
		setFaqSearchFocusFlash(false)
	);
	useAssistantFlashTimeout(clearLocalFaqFlash, () =>
		setClearLocalFaqFlash(false)
	);
	useAssistantFlashTimeout(faqInsertFlashId, () => setFaqInsertFlashId(null));
	useAssistantFlashTimeout(faqShowFlashId, () => setFaqShowFlashId(null));
	useAssistantFlashTimeout(faqAskFlashId, () => setFaqAskFlashId(null));
	useAssistantFlashTimeout(faqBulkActionFlash, () =>
		setFaqBulkActionFlash(null)
	);

	const signalFaqRefreshFlash = React.useCallback(() => {
		setFaqRefreshFlash(true);
	}, []);

	const signalFaqSearchFocusFlash = React.useCallback(() => {
		setFaqSearchFocusFlash(true);
	}, []);

	const signalClearLocalFaqFlash = React.useCallback(() => {
		setClearLocalFaqFlash(true);
	}, []);

	const signalFaqInsertFlash = React.useCallback((flashId: string) => {
		setFaqInsertFlashId(flashId);
	}, []);

	const signalFaqShowFlash = React.useCallback((flashId: string) => {
		setFaqShowFlashId(flashId);
	}, []);

	const signalFaqAskFlash = React.useCallback((flashId: string) => {
		setFaqAskFlashId(flashId);
	}, []);

	return {
		faqRefreshFlash,
		faqSearchFocusFlash,
		clearLocalFaqFlash,
		faqInsertFlashId,
		faqShowFlashId,
		faqAskFlashId,
		faqBulkActionFlash,
		setFaqBulkActionFlash,
		signalFaqRefreshFlash,
		signalFaqSearchFocusFlash,
		signalClearLocalFaqFlash,
		signalFaqInsertFlash,
		signalFaqShowFlash,
		signalFaqAskFlash,
	};
}
