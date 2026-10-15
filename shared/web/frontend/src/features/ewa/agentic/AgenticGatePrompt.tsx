/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HITL gate prompt for agentic sessions — confirm / choose / freeform variants.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 */

import { useTranslation } from 'react-i18next';

import type { AgenticGateView } from '@/features/ewa/agentic/agenticGateUtils';
import {
	formatAgenticGatePrompt,
	formatAgenticGateTitle,
} from '@/features/ewa/agentic/agenticObservabilityUi';
import { CompanionConfirmBar } from '@/features/ewa/companionOperations/CompanionConfirmBar';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type AgenticGatePromptProps = {
	runId: string;
	gate: AgenticGateView;
	busy: boolean;
	onConfirmRun: (runId: string, decision: 'confirm' | 'cancel') => void;
};

export function AgenticGatePrompt({
	runId,
	gate,
	busy,
	onConfirmRun,
}: AgenticGatePromptProps) {
	const { t } = useTranslation();
	const gateTitle = formatAgenticGateTitle(gate.title, t);
	const gatePrompt = formatAgenticGatePrompt(gate.prompt, t, gate.pendingTool);

	if (gate.kind === 'choose' && gate.options.length > 0) {
		return (
			<div className="mt-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
				<p className="text-xs font-medium text-amber-100/90">{gateTitle}</p>
				<p className="text-xs text-amber-100/90">{gatePrompt}</p>
				<div className="flex flex-wrap gap-1">
					{gate.options.map((option) => (
						<button
							key={option}
							type="button"
							disabled={busy}
							className={cn(
								'rounded-md border border-amber-400/40 px-2 py-1 text-[11px] text-amber-100',
								'hover:bg-amber-400/10 disabled:opacity-60',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onConfirmRun(runId, 'confirm')}
						>
							{option}
						</button>
					))}
					<button
						type="button"
						disabled={busy}
						className={cn(
							'rounded-md border border-rose-400/40 px-2 py-1 text-[11px] text-rose-200',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => onConfirmRun(runId, 'cancel')}
					>
						{t('ewaCompanion.operationCancel', 'Отмена')}
					</button>
				</div>
			</div>
		);
	}

	if (gate.kind === 'freeform') {
		return (
			<div className="mt-2 space-y-1 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2">
				<p className="text-xs font-medium text-sky-100/90">
					{gateTitle || t('ewaCompanion.agenticGateClarify', 'Нужно уточнение')}
				</p>
				<p className="text-xs text-sky-100/80">{gatePrompt}</p>
				<p className="text-[10px] text-sky-200/60">
					{t(
						'ewaCompanion.agenticGateFreeformHint',
						'Ответьте в чате — сообщение будет передано задаче.'
					)}
				</p>
			</div>
		);
	}

	return (
		<div className="mt-2 space-y-1">
			<p className="text-xs font-medium text-amber-100/90">{gateTitle}</p>
			<p className="text-xs text-amber-100/80">{gatePrompt}</p>
			{gate.companionPendingTaskRunId ? (
				<p className="text-[10px] text-amber-100/60">
					{t(
						'ewaCompanion.agenticGateConfirmOnMissionCard',
						'Подтверждайте здесь — это шаг агентной миссии, не отдельная операция.'
					)}
				</p>
			) : null}
			<CompanionConfirmBar runId={runId} busy={busy} onConfirm={onConfirmRun} />
		</div>
	);
}
