/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Animated horizontal step chain for user declarative workflows (Сценарий).
 *
 * Invariants:
 * - Pure presentation; step labels via companionOperationsUi helpers.
 *
 * Related:
 * - src/features/ewa/companionOperations/InTranscriptProgressBanner.tsx
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 */

import { CheckIcon } from '@heroicons/react/20/solid';
import { useTranslation } from 'react-i18next';

import {
	operationStepStatusLabel,
	resolveWorkflowStepKindLabel,
	workflowStepVisualState,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskStep } from '@/services/ewa/ewaCompanionChatApi';
import { cn } from '@/utils/cn';

export type CompanionWorkflowStepChainProps = {
	steps: EwaCompanionTaskStep[];
	compact?: boolean;
	className?: string;
};

function ConnectorSegment({
	state,
	compact,
}: {
	state: 'done' | 'active' | 'idle';
	compact?: boolean;
}) {
	return (
		<div
			className={cn(
				'flex shrink-0 items-center self-start',
				compact ? 'mt-[11px] w-3' : 'mt-[13px] w-4'
			)}
			aria-hidden
		>
			<div
				className={cn(
					'h-0.5 w-full origin-left rounded-full transition-all duration-700 ease-out',
					state === 'done' && 'bg-emerald-400/70',
					state === 'active' &&
						'animate-[workflow-connector-flow-h_1.4s_ease-in-out_infinite] bg-gradient-to-r from-emerald-400/80 via-(--companion-aura)/90 to-(--companion-divider)/40',
					state === 'idle' && 'bg-(--companion-divider)/45'
				)}
			/>
		</div>
	);
}

function StepNode({
	step,
	compact,
}: {
	step: EwaCompanionTaskStep;
	compact?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const visual = workflowStepVisualState(step);
	const label = resolveWorkflowStepKindLabel(step, t);
	const statusLabel = operationStepStatusLabel(step.status, t);
	const nodeSize = compact ? 'size-[22px]' : 'size-[26px]';

	return (
		<div
			className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
			data-testid="ewa-workflow-step-node"
			data-step-state={visual}
		>
			<div className="relative shrink-0">
				{visual === 'running' ? (
					<span
						className="absolute -inset-1 rounded-full bg-(--companion-aura)/25 animate-ping motion-reduce:animate-none"
						aria-hidden
					/>
				) : null}
				<div
					className={cn(
						'relative flex items-center justify-center rounded-full border transition-all duration-500 ease-out',
						nodeSize,
						visual === 'completed' &&
							'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.25)]',
						visual === 'running' &&
							'border-(--companion-aura)/70 bg-(--companion-aura)/15 text-(--companion-aura) shadow-[0_0_14px_color-mix(in_srgb,var(--companion-aura)_35%,transparent)]',
						visual === 'failed' &&
							'border-rose-400/60 bg-rose-500/15 text-rose-200',
						visual === 'pending' &&
							'border-(--companion-divider)/70 bg-(--desktop-surface-soft)/40 text-(--companion-text-soft)/70',
						visual === 'cancelled' &&
							'border-(--companion-divider)/50 bg-transparent text-(--companion-text-soft)/50'
					)}
				>
					{visual === 'completed' ? (
						<CheckIcon
							className={compact ? 'size-3' : 'size-3.5'}
							aria-hidden
						/>
					) : visual === 'running' ? (
						<span
							className="size-2 rounded-full bg-(--companion-aura) animate-pulse motion-reduce:animate-none"
							aria-hidden
						/>
					) : visual === 'failed' ? (
						<span className="text-[10px] font-bold leading-none" aria-hidden>
							!
						</span>
					) : (
						<span
							className="size-1.5 rounded-full bg-(--companion-divider)/80"
							aria-hidden
						/>
					)}
				</div>
			</div>
			<div className="w-full min-w-0 px-0.5">
				<p
					className={cn(
						'truncate font-medium leading-tight transition-colors duration-300',
						compact ? 'text-[9px]' : 'text-[10px]',
						visual === 'completed' && 'text-emerald-100/95',
						visual === 'running' && 'text-(--desktop-text-primary)',
						visual === 'failed' && 'text-rose-200',
						(visual === 'pending' || visual === 'cancelled') &&
							'text-(--companion-text-soft)/80'
					)}
					title={label}
				>
					{label}
				</p>
				{statusLabel ? (
					<p
						className={cn(
							'truncate leading-tight transition-opacity duration-300',
							compact ? 'text-[8px]' : 'text-[9px]',
							visual === 'running'
								? 'text-(--companion-aura)/90 opacity-100'
								: 'text-(--companion-text-soft)/75 opacity-90'
						)}
					>
						{statusLabel}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function CompanionWorkflowStepChain({
	steps,
	compact = false,
	className,
}: CompanionWorkflowStepChainProps) {
	if (!steps.length) return null;
	const ordered = [...steps].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);

	return (
		<ol
			className={cn(
				'flex list-none items-start overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
				className
			)}
			data-testid="ewa-workflow-step-chain"
			aria-label="Workflow steps"
		>
			{ordered.map((step, index) => {
				const visual = workflowStepVisualState(step);
				const prevVisual =
					index > 0
						? workflowStepVisualState(
								ordered[index - 1] as EwaCompanionTaskStep
							)
						: null;
				const connectorState =
					prevVisual === 'completed' && visual === 'completed'
						? 'done'
						: visual === 'running' ||
								prevVisual === 'running' ||
								prevVisual === 'completed'
							? 'active'
							: 'idle';
				return (
					<li
						key={step.id || `${step.step_index}-${step.step_kind}`}
						className="flex min-w-0 flex-1 list-none items-start"
					>
						{index > 0 ? (
							<ConnectorSegment state={connectorState} compact={compact} />
						) : null}
						<StepNode step={step} compact={compact} />
					</li>
				);
			})}
		</ol>
	);
}
