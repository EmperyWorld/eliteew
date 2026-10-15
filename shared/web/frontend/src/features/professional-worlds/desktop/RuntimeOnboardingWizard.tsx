/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime onboarding wizard driven by Professional Worlds vertical or pack metadata.
 *
 * Invariants:
 * - Step completion is stored in user onboarding state, not in pack metadata.
 * - Unknown metadata shapes fall back to a compact default wizard instead of blocking the workspace.
 *
 * Related:
 * - api.ts
 * - professionalWorlds.json (`onboardingWizard.*`)
 */

import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from './layout';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	extractOnboardingCompletedSteps,
	onboardingStepNavigateTarget,
} from './onboardingWizardLogic';
import type {
	ProfessionalUserVerticalActivation,
	ProfessionalWorldsRuntimeConfig,
	ProfessionVertical,
} from './types';

export interface RuntimeOnboardingStep {
	key: string;
	title: string;
	description: string;
	actionLabel?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asSteps(value: unknown): RuntimeOnboardingStep[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.map((item, index): RuntimeOnboardingStep | null => {
			if (!isRecord(item)) {
				return null;
			}
			const key = String(item.key ?? item.id ?? `step-${index + 1}`);
			const title = String(item.title ?? item.label ?? key);
			const description = String(item.description ?? item.body ?? '');
			const actionLabel =
				typeof item.actionLabel === 'string'
					? item.actionLabel
					: typeof item.action_label === 'string'
						? item.action_label
						: undefined;
			return { key, title, description, actionLabel };
		})
		.filter((step): step is RuntimeOnboardingStep => step !== null);
}

function defaultSteps(
	verticalName: string,
	t: TFunction<typeof PROFESSIONAL_WORLDS_NS>
): RuntimeOnboardingStep[] {
	return [
		{
			key: 'profile',
			title: t('onboardingWizard.defaultSteps.profileTitle', { verticalName }),
			description: t('onboardingWizard.defaultSteps.profileDesc'),
		},
		{
			key: 'first-object',
			title: t('onboardingWizard.defaultSteps.firstObjectTitle'),
			description: t('onboardingWizard.defaultSteps.firstObjectDesc'),
		},
		{
			key: 'first-artifact',
			title: t('onboardingWizard.defaultSteps.firstArtifactTitle'),
			description: t('onboardingWizard.defaultSteps.firstArtifactDesc'),
		},
	];
}

function extractCompletedSteps(
	onboarding: Record<string, unknown>
): Set<string> {
	return extractOnboardingCompletedSteps(onboarding);
}

function extractPackSteps(
	vertical: ProfessionVertical | null,
	runtimeConfig: ProfessionalWorldsRuntimeConfig | null
): RuntimeOnboardingStep[] {
	const workspaceOnboarding = isRecord(vertical?.workspace_template)
		? vertical.workspace_template.onboarding
		: null;
	// Runtime OpenAPI schema has no `onboarding` field; pack steps may still
	// arrive as an extra bag on workspace/runtime JSON — read via record guard.
	const runtimeBag: unknown = runtimeConfig;
	const configOnboarding = isRecord(runtimeBag) ? runtimeBag.onboarding : null;
	const workspaceSteps = isRecord(workspaceOnboarding)
		? asSteps(workspaceOnboarding.steps)
		: asSteps(workspaceOnboarding);
	const configSteps = isRecord(configOnboarding)
		? asSteps(configOnboarding.steps)
		: asSteps(configOnboarding);
	return configSteps.length > 0 ? configSteps : workspaceSteps;
}

function translatePackStep(
	step: RuntimeOnboardingStep,
	t: TFunction<typeof PROFESSIONAL_WORLDS_NS>
): RuntimeOnboardingStep {
	const titleKey = `onboardingWizard.steps.${step.key}.title`;
	const descriptionKey = `onboardingWizard.steps.${step.key}.description`;
	const actionKey = `onboardingWizard.steps.${step.key}.actionLabel`;
	const title = t(titleKey);
	const description = t(descriptionKey);
	const actionLabel = t(actionKey);
	return {
		...step,
		title: title === titleKey ? step.title : title,
		description:
			description === descriptionKey ? step.description : description,
		actionLabel: actionLabel === actionKey ? step.actionLabel : actionLabel,
	};
}

function verticalDisplayName(
	vertical: ProfessionVertical | null,
	runtimeConfig: ProfessionalWorldsRuntimeConfig | null,
	t: TFunction<typeof PROFESSIONAL_WORLDS_NS>
): string {
	const slug = vertical?.slug ?? runtimeConfig?.vertical_slug;
	if (slug) {
		const labelKey = `onboardingWizard.verticalNames.${slug}`;
		const label = t(labelKey);
		if (label !== labelKey) {
			return label;
		}
	}
	return (
		vertical?.name ??
		runtimeConfig?.vertical_slug ??
		t('onboardingWizard.fallbackVertical')
	);
}

export function RuntimeOnboardingWizard({
	activation,
	runtimeConfig,
	vertical,
	onPatchOnboarding,
	onNavigateToStep,
}: {
	activation: ProfessionalUserVerticalActivation | null;
	runtimeConfig: ProfessionalWorldsRuntimeConfig | null;
	vertical: ProfessionVertical | null;
	onPatchOnboarding: (
		onboarding: Record<string, unknown>
	) => void | Promise<void>;
	onNavigateToStep?: (stepKey: string) => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [busyStep, setBusyStep] = useState<string | null>(null);
	const [stepError, setStepError] = useState<string | null>(null);
	const verticalName = verticalDisplayName(vertical, runtimeConfig, t);
	const steps = useMemo(() => {
		const metadataSteps = extractPackSteps(vertical, runtimeConfig);
		return metadataSteps.length > 0
			? metadataSteps.map((step) => translatePackStep(step, t))
			: defaultSteps(verticalName, t);
	}, [runtimeConfig, vertical, verticalName, t]);
	const completedSteps = extractCompletedSteps(activation?.onboarding ?? {});
	const doneCount = steps.filter((step) => completedSteps.has(step.key)).length;

	async function completeStep(stepKey: string) {
		const nextCompleted = new Set(completedSteps);
		nextCompleted.add(stepKey);
		setBusyStep(stepKey);
		setStepError(null);
		try {
			await onPatchOnboarding({
				...(activation?.onboarding ?? {}),
				completed_steps: [...nextCompleted],
			});
		} catch (err: unknown) {
			setStepError(
				err instanceof Error ? err.message : t('onboardingWizard.saveFailed')
			);
		} finally {
			setBusyStep(null);
		}
	}

	if (doneCount === steps.length) {
		return null;
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('onboardingWizard.sectionTitle')}
		>
			<p className="text-xs text-(--desktop-text-secondary)">
				{t('onboardingWizard.progress', {
					done: doneCount,
					total: steps.length,
					verticalName,
				})}
			</p>
			<p className="text-xs text-(--desktop-text-muted)">
				{t('onboardingWizard.autoCompleteHint')}
			</p>
			{stepError ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{stepError}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<div className="grid gap-2">
				{steps.map((step) => {
					const done = completedSteps.has(step.key);
					const navigateTarget = onboardingStepNavigateTarget(step.key);
					const goLabelKey = `onboardingWizard.steps.${step.key}.goLabel`;
					const goLabel = t(goLabelKey);
					const resolvedGoLabel =
						goLabel === goLabelKey ? t('onboardingWizard.goToStep') : goLabel;
					return (
						<div
							key={step.key}
							className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									<strong className="text-sm text-(--desktop-text-primary)">
										{step.title}
									</strong>
									<p className="mt-1 text-xs text-(--desktop-text-secondary)">
										{step.description}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									{navigateTarget && onNavigateToStep && !done ? (
										<DesktopAppButton
											size="sm"
											variant="accent"
											disabled={busyStep !== null}
											onClick={() => onNavigateToStep(step.key)}
										>
											{resolvedGoLabel}
										</DesktopAppButton>
									) : null}
									<DesktopAppButton
										size="sm"
										variant={done ? 'ghost' : 'ghost'}
										disabled={done || busyStep !== null}
										onClick={() => void completeStep(step.key)}
									>
										{done
											? t('onboardingWizard.done')
											: busyStep === step.key
												? t('onboardingWizard.saving')
												: (step.actionLabel ?? t('onboardingWizard.markDone'))}
									</DesktopAppButton>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
