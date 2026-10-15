/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bundles tool-trace, execution-report, and proactive-suggestion strips above the transcript (U8.3 slice 9).
 *
 * Invariants:
 * - Proactive strip respects per-principal snooze storage; hidden when snoozed for today.
 *
 * Related:
 * - src/features/ewa/CompanionToolTraceStrip.tsx
 * - src/features/ewa/CompanionExecutionReportStrip.tsx
 * - src/features/ewa/CompanionProactiveSuggestionStrip.tsx
 */

import { CompanionExecutionReportStrip } from '@/features/ewa/CompanionExecutionReportStrip';
import { CompanionProactiveSuggestionStrip } from '@/features/ewa/CompanionProactiveSuggestionStrip';
import { CompanionToolTraceStrip } from '@/features/ewa/CompanionToolTraceStrip';
import {
	isProactiveSnoozedToday,
	snoozeProactiveUntilEndOfDay,
} from '@/features/ewa/companionUx/companionProactiveSnoozeStorage';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import type {
	CompanionExecutionReport,
	CompanionProactiveSuggestion,
	CompanionToolTraceEntry,
} from '@/services/ewa/ewaCompanionChatApi';
import {
	EWA_COMPANION_SOFT_INITIATIVE_PREF_KEY,
	endOfLocalDayIso,
	mergeEwaCompanionSoftInitiativeSnoozePref,
	patchEwaCompanionProfile,
} from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionProtocolStripsProps = {
	toolTrace: CompanionToolTraceEntry[];
	protocolReports: CompanionExecutionReport[];
	orchestrationOutcome: string | null;
	proactiveSuggestion: CompanionProactiveSuggestion | null;
	principalId: string;
	/** Optional LP map so snooze can mirror to server soft_initiative. */
	learnedPreferences?: Record<string, unknown> | null;
	companionRevision?: number | null;
	onQuickReply: (chip: string) => void;
	onDismissProactive: () => void;
};

export function CompanionProtocolStrips({
	toolTrace,
	protocolReports,
	orchestrationOutcome,
	proactiveSuggestion,
	principalId,
	learnedPreferences = null,
	companionRevision = null,
	onQuickReply,
	onDismissProactive,
}: CompanionProtocolStripsProps) {
	const mirrorSnoozeToServer = () => {
		const merged = mergeEwaCompanionSoftInitiativeSnoozePref(
			learnedPreferences,
			endOfLocalDayIso()
		);
		void patchEwaCompanionProfile({
			learned_preferences: {
				[EWA_COMPANION_SOFT_INITIATIVE_PREF_KEY]:
					merged[EWA_COMPANION_SOFT_INITIATIVE_PREF_KEY],
			},
			...(typeof companionRevision === 'number'
				? { expect_revision: companionRevision }
				: {}),
		}).catch((err) => {
			ewaCompanionDegradeDebug(
				'companion_soft_initiative_snooze_patch',
				'server snooze mirror failed',
				err
			);
		});
	};

	return (
		<>
			<CompanionToolTraceStrip trace={toolTrace} />
			<CompanionExecutionReportStrip
				reports={protocolReports}
				orchestrationOutcome={orchestrationOutcome}
			/>
			{proactiveSuggestion && !isProactiveSnoozedToday(principalId) ? (
				<CompanionProactiveSuggestionStrip
					suggestion={proactiveSuggestion}
					onQuickReply={onQuickReply}
					onDismiss={onDismissProactive}
					onSnoozeToday={() => {
						snoozeProactiveUntilEndOfDay(principalId);
						mirrorSnoozeToServer();
						onDismissProactive();
					}}
				/>
			) : null}
		</>
	);
}
