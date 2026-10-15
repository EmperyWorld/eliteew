/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assembles the center mission decision, degraded, mission, and transcript surfaces.
 *
 * Invariants:
 * - Decision and degraded states take precedence when no primary mission exists.
 * - A stale mission never receives live-looking chrome without its degraded notice.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionCenterMissionCanvas.tsx
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

import type { CompanionOperationsDegradedKind } from '@/features/ewa/companionOperations/companionOperationsStore';
import type { MissionSurfaceBundle } from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	CompanionCenterDecisionCard,
	CompanionCenterMissionCanvas,
	CompanionCenterMissionUnavailable,
} from '@/features/ewa/companionUx/CompanionCenterMissionCanvas';
import {
	CompanionTranscriptMessageList,
	type CompanionTranscriptMessageListProps,
} from '@/features/ewa/companionUx/CompanionTranscriptMessageList';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

export type BuildCompanionCenterMissionCanvasInput = {
	primaryCenterMission: MissionSurfaceBundle | null;
	blockingConfirmationRun: EwaCompanionTaskRun | null;
	operationsLastErrorMessage: string | null;
	operationsLastErrorKind: CompanionOperationsDegradedKind | null;
	operationsRefreshing: boolean;
	onRefreshOperationRuns: () => void;
	confirmBusyRunId: string | null;
	onConfirmOperationRun: (
		runId: string,
		decision: 'confirm' | 'cancel'
	) => void;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onDraftPlayPrompt: (text: string) => void;
	onOpenCompanionPlan: () => void;
	onDismissMission?: (runId: string) => void;
	missionChromeCollapsed: boolean;
	onSetMissionChromeCollapsed: (collapsed: boolean) => void;
	empty: boolean;
	pending: boolean;
	streamingText: string;
	transcriptMessageListProps: CompanionTranscriptMessageListProps;
	t: TFunction<'marketing'>;
};

export function buildCompanionCenterMissionCanvas({
	primaryCenterMission,
	blockingConfirmationRun,
	operationsLastErrorMessage,
	operationsLastErrorKind,
	operationsRefreshing,
	onRefreshOperationRuns,
	confirmBusyRunId,
	onConfirmOperationRun,
	onDispatchActions,
	onDraftPlayPrompt,
	onOpenCompanionPlan,
	onDismissMission,
	missionChromeCollapsed,
	onSetMissionChromeCollapsed,
	empty,
	pending,
	streamingText,
	transcriptMessageListProps,
	t,
}: BuildCompanionCenterMissionCanvasInput): ReactNode {
	if (!primaryCenterMission && blockingConfirmationRun) {
		return (
			<CompanionCenterDecisionCard
				run={blockingConfirmationRun}
				confirmBusyRunId={confirmBusyRunId}
				onConfirmRun={onConfirmOperationRun}
			/>
		);
	}
	if (!primaryCenterMission && operationsLastErrorMessage) {
		return (
			<CompanionCenterMissionUnavailable
				kind={operationsLastErrorKind}
				message={operationsLastErrorMessage}
				refreshing={operationsRefreshing}
				onRefresh={onRefreshOperationRuns}
			/>
		);
	}
	if (!primaryCenterMission) return null;
	return (
		<CompanionCenterMissionCanvas
			mission={primaryCenterMission}
			blockingDecisionRun={blockingConfirmationRun}
			degradedKind={
				operationsLastErrorKind ??
				(primaryCenterMission.displayState === 'stale' ? 'stale' : null)
			}
			degradedMessage={
				operationsLastErrorMessage ??
				(primaryCenterMission.displayState === 'stale'
					? t(
							'ewaCompanion.centerMissionHeartbeatStaleBody',
							'Миссия давно не обновлялась. Статус «Running» скрыт, пока не появится свежий heartbeat.'
						)
					: null)
			}
			degradedRefreshing={operationsRefreshing}
			onRefreshMissionStatus={onRefreshOperationRuns}
			confirmBusyRunId={confirmBusyRunId}
			onConfirmRun={onConfirmOperationRun}
			onDispatchActions={onDispatchActions}
			onPlayTrack={(action) => onDispatchActions([action])}
			onDraftPlayPrompt={onDraftPlayPrompt}
			onOpenPresentationInEwrp={(jobId) =>
				requestOpenDesktopApp({ appComponent: 'EWRP', ewrpJobId: jobId })
			}
			onOpenCompanionPlan={onOpenCompanionPlan}
			onDismissMission={onDismissMission}
			missionChromeCollapsed={missionChromeCollapsed}
			onSetMissionChromeCollapsed={onSetMissionChromeCollapsed}
			supportingTranscript={
				!empty || pending || streamingText ? (
					<CompanionTranscriptMessageList {...transcriptMessageListProps} />
				) : null
			}
		/>
	);
}
