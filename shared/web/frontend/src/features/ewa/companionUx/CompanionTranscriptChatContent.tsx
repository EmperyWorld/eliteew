/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transcript chat column: onboarding hints, empty/list states, scroll anchor (U8.3 slice 17).
 *
 * Invariants:
 * - Onboarding hints render only in chat mode when transcript is empty.
 * - When Master Dashboard Gateway is visible, onboarding is suppressed to keep one primary IA.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptMessageList.tsx
 * - companionGateway/CompanionMasterDashboard.tsx
 */

import type { ReactNode, RefObject } from 'react';

import { CompanionTranscriptEmptyState } from '@/features/ewa/companionUx/CompanionTranscriptEmptyState';
import { CompanionTranscriptLatestReplyHint } from '@/features/ewa/companionUx/CompanionTranscriptLatestReplyHint';
import {
	CompanionTranscriptMessageList,
	type CompanionTranscriptMessageListProps,
} from '@/features/ewa/companionUx/CompanionTranscriptMessageList';
import { CompanionUxOnboardingHints } from '@/features/ewa/companionUx/CompanionUxOnboardingHints';

export type CompanionTranscriptChatContentProps = {
	showOnboardingHints: boolean;
	companionPrincipalId: string;
	onOpenTools: () => void;
	onOpenWorkflows: () => void;
	onOpenOperations: () => void;
	onChooseMissionPrompt?: (prompt: string) => void;
	onStartAgentic?: () => void;
	onCreateMedia?: () => void;
	onAccessDocuments?: () => void;
	empty: boolean;
	showMissionNarrativeWhenEmpty?: boolean;
	centerMissionCanvas?: ReactNode;
	displayName: string;
	showLatestReplyHint: boolean;
	messageListProps: CompanionTranscriptMessageListProps;
	bottomRef: RefObject<HTMLDivElement | null>;
	/** Compact empty gateway for `#/mobile-ewa-companion`. */
	embeddedMobile?: boolean;
};

export function CompanionTranscriptChatContent({
	showOnboardingHints,
	companionPrincipalId,
	onOpenTools,
	onOpenWorkflows,
	onOpenOperations,
	onChooseMissionPrompt,
	onStartAgentic,
	onCreateMedia,
	onAccessDocuments,
	empty,
	showMissionNarrativeWhenEmpty = false,
	centerMissionCanvas = null,
	displayName,
	showLatestReplyHint,
	messageListProps,
	bottomRef,
	embeddedMobile = false,
}: CompanionTranscriptChatContentProps) {
	const gatewayVisible =
		empty && !showMissionNarrativeWhenEmpty && !centerMissionCanvas;
	const showOnboardingAboveTranscript =
		showOnboardingHints && !centerMissionCanvas && !gatewayVisible;

	return (
		<>
			{showOnboardingAboveTranscript ? (
				<CompanionUxOnboardingHints
					principalId={companionPrincipalId}
					onOpenTools={onOpenTools}
					onOpenWorkflows={onOpenWorkflows}
					onOpenOperations={onOpenOperations}
				/>
			) : null}
			{showLatestReplyHint ? (
				<CompanionTranscriptLatestReplyHint
					principalId={companionPrincipalId}
				/>
			) : null}
			{empty && !showMissionNarrativeWhenEmpty && !centerMissionCanvas ? (
				<CompanionTranscriptEmptyState
					displayName={displayName}
					onOpenTools={onOpenTools}
					onChooseMissionPrompt={onChooseMissionPrompt}
					onStartAgentic={onStartAgentic}
					onCreateMedia={onCreateMedia}
					onManageWorkflows={onOpenWorkflows}
					onAccessDocuments={onAccessDocuments}
					embeddedMobile={embeddedMobile}
				/>
			) : (
				(centerMissionCanvas ?? (
					<CompanionTranscriptMessageList {...messageListProps} />
				))
			)}
			<div ref={bottomRef} />
		</>
	);
}
