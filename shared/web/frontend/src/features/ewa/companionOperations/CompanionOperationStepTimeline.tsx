/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Step timeline for one companion task run — delegates user workflows to animated chain.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionWorkflowStepChain.tsx
 */

import { useTranslation } from 'react-i18next';

import { companionStepKindIcon } from '@/features/ewa/companionOperations/companionStepKindVisual';
import { CompanionWorkflowStepChain } from '@/features/ewa/companionOperations/CompanionWorkflowStepChain';
import {
	isUserActionWorkflowRun,
	operationStepDisplayTitle,
	operationStepStatusLabel,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskStep } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionOperationStepTimelineProps = {
	steps: EwaCompanionTaskStep[];
	run?: EwaCompanionTaskRun | null;
	compact?: boolean;
	reducedMotion?: boolean;
};

export function CompanionOperationStepTimeline({
	steps,
	run = null,
	compact = false,
	reducedMotion = false,
}: CompanionOperationStepTimelineProps) {
	const { t } = useTranslation('marketing');
	if (!steps.length) return null;

	if (run && isUserActionWorkflowRun(run)) {
		return (
			<CompanionWorkflowStepChain
				steps={steps}
				compact={compact}
				className={reducedMotion ? 'motion-reduce:transition-none' : undefined}
			/>
		);
	}

	const ordered = [...steps].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);
	return (
		<ol className="mt-1 flex flex-col gap-0.5 border-l border-(--companion-divider)/60 pl-2">
			{ordered.map((step) => {
				const statusLabel = operationStepStatusLabel(step.status, t);
				const icon = companionStepKindIcon(step.step_kind, step.status);
				return (
					<li
						key={step.id}
						className={cn(
							'flex items-start gap-1 text-[10px] leading-snug',
							step.status === 'failed'
								? 'text-rose-300'
								: step.status === 'completed'
									? 'text-emerald-200/90'
									: 'text-(--companion-text-soft)'
						)}
					>
						<EwaIcon
							name={icon}
							size="xs"
							tone={
								step.status === 'failed'
									? 'danger'
									: step.status === 'completed'
										? 'success'
										: 'muted'
							}
							className="mt-0.5 shrink-0"
						/>
						<span>
							<span className="font-medium">
								{operationStepDisplayTitle(step, t)}
							</span>
							{statusLabel ? (
								<span className="text-(--companion-text-soft)">
									{' '}
									· {statusLabel}
								</span>
							) : null}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
