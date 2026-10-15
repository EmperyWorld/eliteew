/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Query gating for marketing client-interaction (tab bar defers chat bridge and polls).
 *
 * Invariants:
 * - With tab bar, chat bridge/messages only on `chat` tab; section queries match active tab.
 *
 * Related:
 * - views/client-interaction/useClientInteractionController.ts
 */
import type { ClientInteractionLayout } from './views/client-interaction/clientInteractionTypes';
import type { ClientInteractionMarketingTab } from './views/client-interaction/clientInteractionTabs';

export function marketingCabinetClientInteractionUsesTabBar(
	visibleTabCount: number
): boolean {
	return visibleTabCount > 0;
}

/** GAF bridge + message poll — only when chat UI is active. */
export function shouldLoadClientInteractionChat(
	layout: ClientInteractionLayout,
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean
): boolean {
	if (showTabBar) {
		return marketingTab === 'chat';
	}
	return layout === 'full' || layout === 'chat-only';
}

/** Doc approvals list — only when documents UI is active. */
export function shouldLoadClientInteractionDocs(
	layout: ClientInteractionLayout,
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean,
	hasProject: boolean
): boolean {
	if (!hasProject) return false;
	if (showTabBar) {
		return marketingTab === 'documents';
	}
	return layout === 'full' || layout === 'documents-only';
}

/** Presentation shares list — only when presentations UI is active. */
export function shouldLoadClientInteractionShares(
	layout: ClientInteractionLayout,
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean,
	hasProject: boolean
): boolean {
	if (!hasProject) return false;
	if (showTabBar) {
		return marketingTab === 'presentations';
	}
	return layout === 'full' || layout === 'presentations-only';
}

export function shouldLoadClientInteractionLeadContent(
	layout: ClientInteractionLayout,
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean,
	isLead: boolean,
	readOnlyMarketing: boolean
): boolean {
	if (!isLead || readOnlyMarketing) return false;
	if (showTabBar) {
		return marketingTab === 'documents';
	}
	return layout === 'full' || layout === 'documents-only';
}

export function shouldLoadClientInteractionEwrp(
	layout: ClientInteractionLayout,
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean,
	isLead: boolean,
	readOnlyMarketing: boolean
): boolean {
	if (!isLead || readOnlyMarketing) return false;
	if (showTabBar) {
		return marketingTab === 'presentations';
	}
	return layout === 'full' || layout === 'presentations-only';
}

export function shouldLoadClientInteractionDiagnosticSettings(
	marketingTab: ClientInteractionMarketingTab,
	showTabBar: boolean,
	isLead: boolean,
	readOnlyMarketing: boolean
): boolean {
	if (!isLead || readOnlyMarketing) return false;
	if (showTabBar) {
		return marketingTab === 'diagnostic';
	}
	return true;
}
