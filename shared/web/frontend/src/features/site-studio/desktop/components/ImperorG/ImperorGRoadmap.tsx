/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Timeline-style roadmap for Site Studio auto-fill phases and nested steps.
 *
 * Invariants:
 * - The roadmap is display-only; phase execution remains owned by `useImperorG`.
 * - Status badges must use localized user-facing copy, not hardcoded runtime labels.
 *
 * Related:
 * - `features/site-studio/desktop/components/ImperorG/ImperorGPanel.tsx`
 * - `features/site-studio/desktop/api-imperorg.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	BoltIcon,
	BookOpenIcon,
	CheckIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	MapIcon,
	MegaphoneIcon,
	MusicalNoteIcon,
	RocketLaunchIcon,
	SwatchIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import type { ImperorGPhase, ImperorGStepStatus } from '../../api-imperorg';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
	search: MagnifyingGlassIcon,
	compass: MapIcon,
	megaphone: MegaphoneIcon,
	'book-open': BookOpenIcon,
	target: BoltIcon,
	globe: GlobeAltIcon,
	palette: SwatchIcon,
	music: MusicalNoteIcon,
	rocket: RocketLaunchIcon,
};

function PhaseIcon({
	icon,
	status,
}: {
	icon: string;
	status: ImperorGStepStatus;
}) {
	if (status === 'running') {
		return (
			<ArrowPathIcon className="h-5 w-5 animate-spin text-amber-400 motion-reduce:animate-none" />
		);
	}
	if (status === 'done') {
		return <CheckIcon className="h-5 w-5 text-emerald-400" />;
	}
	if (status === 'error') {
		return <XCircleIcon className="h-5 w-5 text-red-400" />;
	}
	const Icon = ICON_MAP[icon] ?? MagnifyingGlassIcon;
	return <Icon className="h-5 w-5 text-(--desktop-text-tertiary)" />;
}

function statusRingClass(status: ImperorGStepStatus): string {
	switch (status) {
		case 'running':
			return 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.15)] motion-reduce:shadow-none';
		case 'done':
			return 'border-emerald-400/50 bg-emerald-500/10';
		case 'error':
			return 'border-red-400/50 bg-red-500/10';
		default:
			return 'border-(--desktop-border-secondary) bg-(--desktop-bg-tertiary)';
	}
}

function stepDotClass(status: ImperorGStepStatus): string {
	switch (status) {
		case 'running':
			return 'bg-amber-400 animate-pulse motion-reduce:animate-none';
		case 'done':
			return 'bg-emerald-400';
		case 'error':
			return 'bg-red-400';
		default:
			return 'bg-(--desktop-text-tertiary)';
	}
}

function lineClass(status: ImperorGStepStatus): string {
	if (status === 'done') return 'bg-emerald-400/40';
	if (status === 'running') return 'bg-amber-400/30';
	return 'bg-(--desktop-border-secondary)';
}

interface ImperorGRoadmapProps {
	phases: ImperorGPhase[];
	currentPhaseIndex: number;
}

export const ImperorGRoadmap: React.FC<ImperorGRoadmapProps> = ({ phases }) => {
	const { t } = useTranslation('siteStudio');
	if (phases.length === 0) return null;

	return (
		<div className="flex flex-col gap-0">
			{phases.map((phase, idx) => (
				<div key={phase.id} className="flex gap-3">
					{/* Timeline column */}
					<div className="flex w-10 shrink-0 flex-col items-center">
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 motion-reduce:transition-none motion-reduce:duration-0 ${statusRingClass(phase.status)}`}
						>
							<PhaseIcon icon={phase.icon} status={phase.status} />
						</div>
						{idx < phases.length - 1 && (
							<div
								className={`w-0.5 flex-1 min-h-[16px] transition-colors duration-500 motion-reduce:transition-none motion-reduce:duration-0 ${lineClass(phase.status)}`}
							/>
						)}
					</div>

					{/* Content column */}
					<div className="min-w-0 flex-1 pb-5">
						<div className="flex items-center gap-2">
							<span
								className={`text-sm font-medium transition-colors duration-300 motion-reduce:transition-none motion-reduce:duration-0 ${
									phase.status === 'running'
										? 'text-amber-300'
										: phase.status === 'done'
											? 'text-emerald-300'
											: phase.status === 'error'
												? 'text-red-300'
												: 'text-(--desktop-text-secondary)'
								}`}
							>
								{t(`autofill.phases.${phase.id}`, {
									defaultValue: phase.label,
								})}
							</span>
							{phase.status === 'running' && (
								<span className="text-[10px] uppercase tracking-wider text-amber-400/70">
									{t('autofill.roadmapRunningBadge')}
								</span>
							)}
						</div>

						{/* Steps */}
						{phase.steps.length > 0 && (
							<div className="mt-1.5 flex flex-col gap-1">
								{phase.steps.map((step) => (
									<div key={step.stepId} className="flex items-start gap-2">
										<div
											className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${stepDotClass(step.status)}`}
										/>
										<div className="min-w-0">
											<span className="text-xs text-(--desktop-text-secondary)">
												{step.label}
											</span>
											{step.summary && (
												<span className="ml-1.5 text-[10px] text-(--desktop-text-tertiary)">
													— {step.summary}
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	);
};
