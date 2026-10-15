/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Empty transcript placeholder — Master Dashboard Gateway (Unified Workspace).
 *
 * Invariants:
 * - Shown only when there are no messages and no pending/streaming turn.
 *
 * Related:
 * - companionGateway/CompanionMasterDashboard.tsx
 * - documentation/product/ewa/EWA-UNIFIED-WORKSPACE-JOURNEY-2026-07-09.md
 */

import { CompanionMasterDashboard } from '@/features/ewa/companionGateway/CompanionMasterDashboard';

export type CompanionTranscriptEmptyStateProps = {
	displayName: string;
	onOpenTools: () => void;
	onChooseMissionPrompt?: (prompt: string) => void;
	onStartAgentic?: () => void;
	onCreateMedia?: () => void;
	onManageWorkflows?: () => void;
	onAccessDocuments?: () => void;
	/** Compact single-column gateway for `#/mobile-ewa-companion` WebView. */
	embeddedMobile?: boolean;
};

export function CompanionTranscriptEmptyState({
	displayName,
	onOpenTools,
	onChooseMissionPrompt,
	onStartAgentic,
	onCreateMedia,
	onManageWorkflows,
	onAccessDocuments,
	embeddedMobile = false,
}: CompanionTranscriptEmptyStateProps) {
	const startAgentic =
		onStartAgentic ??
		(() =>
			onChooseMissionPrompt?.(
				'Plan and execute a multi-step agentic task for my current goal'
			));
	const createMedia =
		onCreateMedia ??
		(() =>
			onChooseMissionPrompt?.(
				'Create media for my goal and keep the result in this workspace'
			));
	const manageWorkflows = onManageWorkflows ?? onOpenTools;
	const accessDocuments =
		onAccessDocuments ??
		(() =>
			onChooseMissionPrompt?.(
				'List my documents and open the most relevant one here'
			));

	return (
		<CompanionMasterDashboard
			displayName={displayName}
			onOpenTools={onOpenTools}
			onChooseMissionPrompt={onChooseMissionPrompt}
			onStartAgentic={startAgentic}
			onCreateMedia={createMedia}
			onManageWorkflows={manageWorkflows}
			onAccessDocuments={accessDocuments}
			embeddedMobile={embeddedMobile}
		/>
	);
}
