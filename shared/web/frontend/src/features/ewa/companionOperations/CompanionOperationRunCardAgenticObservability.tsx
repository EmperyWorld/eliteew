/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy-loaded agentic observability chunk (task tree + execution trace) for operation cards.
 *
 * Invariants:
 * - Mounted when the operator expands observability on an agentic run card, or when
 *   the center mission canvas keeps the live execution column open for an active session.
 * - Tree and trace HTTP loads are owned by child panels only (no duplicate parent prefetch).
 * - ``refreshToken`` must change when the mirrored task-run revision / step count advances.
 * - Missing ``run`` must not crash the Desktop shell (degrade to tree/trace without doc links).
 *
 * Related:
 * - CompanionOperationRunCard.tsx
 */

import { useTranslation } from 'react-i18next';

import { AgenticExecutionTrace } from '@/features/ewa/agentic/AgenticExecutionTrace';
import { AgenticTaskTreePanel } from '@/features/ewa/agentic/AgenticTaskTreePanel';
import { useAgenticSessionDocuments } from '@/features/ewa/companionOperations/useAgenticSessionDocuments';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatCoerce';

export type CompanionOperationRunCardAgenticObservabilityProps = {
	sessionId: string;
	sessionStatus?: string;
	refreshToken: number;
	run?: EwaCompanionTaskRun | null;
	onPlayTrack?: (action: CompanionChatAction) => void;
};

export default function CompanionOperationRunCardAgenticObservability({
	sessionId,
	sessionStatus = '',
	refreshToken,
	run = null,
	onPlayTrack,
}: CompanionOperationRunCardAgenticObservabilityProps) {
	const { t } = useTranslation('marketing');
	const documents = useAgenticSessionDocuments(run, sessionId);

	const openDoc = (unifiedContentId: string) => {
		if (!onPlayTrack) return;
		onPlayTrack({
			type: 'open_app',
			app_component: 'DocEditor',
			unified_content_id: unifiedContentId,
		});
	};

	if (!sessionId.trim()) return null;
	return (
		<div className="space-y-2" data-testid="ewa-agentic-observability">
			<div>
				<p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
					{t('ewaCompanion.agenticTaskTree')}
				</p>
				<AgenticTaskTreePanel
					sessionId={sessionId}
					sessionStatus={sessionStatus}
					refreshToken={refreshToken}
					documents={documents}
					onOpenDocEditor={openDoc}
				/>
			</div>
			<div>
				<p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
					{t('ewaCompanion.agenticTrace')}
				</p>
				<AgenticExecutionTrace
					sessionId={sessionId}
					sessionStatus={sessionStatus}
					refreshToken={refreshToken}
				/>
			</div>
		</div>
	);
}
