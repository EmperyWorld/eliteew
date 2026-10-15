/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-shot mobile WebView deep-link bootstrap for companion chat (U8.1 extract).
 *
 * Invariants:
 * - Runs once on mount when `mobileEmbeddedLayout` is true; consumes hash query keys.
 *
 * Related:
 * - src/features/ewa/companionUx/companionMobileDeepLink.ts
 */

import { useEffect } from 'react';

import { consumeCompanionMobileDeepLinkIntent } from '@/features/ewa/companionUx/companionMobileDeepLink';

export type UseCompanionMobileDeepLinkBootstrapOptions = {
	mobileEmbeddedLayout: boolean;
	focusOperationRun: (runId: string) => void;
	onOpenToolsCatalog: () => void;
	onOpenMyPhrases: () => void;
	onOpenWorkflowEdit: () => void;
};

export function useCompanionMobileDeepLinkBootstrap({
	mobileEmbeddedLayout,
	focusOperationRun,
	onOpenToolsCatalog,
	onOpenMyPhrases,
	onOpenWorkflowEdit,
}: UseCompanionMobileDeepLinkBootstrapOptions) {
	useEffect(() => {
		if (!mobileEmbeddedLayout) return;
		const intent = consumeCompanionMobileDeepLinkIntent();
		if (!intent) return;
		if (intent.kind === 'operation') {
			focusOperationRun(intent.runId);
			return;
		}
		if (intent.kind === 'tools') {
			onOpenToolsCatalog();
			return;
		}
		if (intent.kind === 'phrases') {
			onOpenMyPhrases();
			return;
		}
		onOpenWorkflowEdit();
	}, [
		focusOperationRun,
		mobileEmbeddedLayout,
		onOpenMyPhrases,
		onOpenToolsCatalog,
		onOpenWorkflowEdit,
	]);
}
