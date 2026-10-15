/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guided UX onboarding v2 — three steps: tools, workflows, operations (U0.4).
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	type CompanionUxOnboardingStepId,
	dismissAllUxOnboarding,
	dismissUxOnboardingStep,
	readDismissedUxOnboardingSteps,
} from '@/features/ewa/companionUx/companionUxOnboardingStorage';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

const STEPS: CompanionUxOnboardingStepId[] = [
	'tools',
	'workflows',
	'operations',
];

export type CompanionUxOnboardingHintsProps = {
	principalId: string;
	onOpenTools: () => void;
	onOpenWorkflows: () => void;
	onOpenOperations: () => void;
};

export function CompanionUxOnboardingHints({
	principalId,
	onOpenTools,
	onOpenWorkflows,
	onOpenOperations,
}: CompanionUxOnboardingHintsProps) {
	const { t } = useTranslation('marketing');
	const [dismissed, setDismissed] = useState(() =>
		readDismissedUxOnboardingSteps(principalId)
	);
	const pending = STEPS.filter((step) => !dismissed.includes(step));
	if (pending.length === 0) return null;

	const handleDismiss = (step: CompanionUxOnboardingStepId) => {
		dismissUxOnboardingStep(principalId, step);
		setDismissed(readDismissedUxOnboardingSteps(principalId));
	};

	const handleDismissAll = () => {
		dismissAllUxOnboarding(principalId);
		setDismissed(readDismissedUxOnboardingSteps(principalId));
	};

	return (
		<CompanionGlassCard
			className="mb-2 px-3 py-2"
			data-testid="ewa-companion-ux-onboarding"
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-[12px] font-medium text-(--desktop-text-primary)">
					{t('ewaCompanion.uxOnboarding.title')}
				</p>
				<button
					type="button"
					className={cn(
						'min-h-10 rounded-full px-2.5 py-1 text-[10px] text-(--companion-text-soft)',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-label={t('ewaCompanion.uxOnboarding.dismissAll')}
					onClick={handleDismissAll}
				>
					{t('ewaCompanion.uxOnboarding.dismissAll')}
				</button>
			</div>
			<ul className="mt-2 flex flex-col gap-1.5">
				{pending.map((step) => (
					<li
						key={step}
						className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/4 px-2 py-1.5"
					>
						<span className="text-[11px] text-(--desktop-text-secondary)">
							{t(`ewaCompanion.uxOnboarding.steps.${step}`)}
						</span>
						<div className="flex shrink-0 gap-1">
							<button
								type="button"
								className={cn(
									'min-h-10 rounded-full px-2.5 py-1 text-[10px] font-medium text-(--companion-aura)',
									'hover:bg-(--companion-aura)/10',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() => {
									if (step === 'tools') onOpenTools();
									if (step === 'workflows') onOpenWorkflows();
									if (step === 'operations') onOpenOperations();
									handleDismiss(step);
								}}
							>
								{t('ewaCompanion.uxOnboarding.try')}
							</button>
							<button
								type="button"
								className={cn(
									'min-h-10 rounded-full px-2.5 py-1 text-[10px] text-(--companion-text-soft)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={() => handleDismiss(step)}
							>
								{t('ewaCompanion.uxOnboarding.skip')}
							</button>
						</div>
					</li>
				))}
			</ul>
		</CompanionGlassCard>
	);
}
