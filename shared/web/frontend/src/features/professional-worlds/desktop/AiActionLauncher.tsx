/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime launcher for AI actions exposed by the active Professional Worlds configuration.
 *
 * Invariants:
 * - Available actions come from runtime `ai_actions`; prompt templates and provider internals are never required here.
 * - Payload text must parse to a JSON object before launch.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsQuotaEstimate } from './components/ProfessionalWorldsQuotaEstimate';
import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from './layout';
import { SupportDetailsPanel } from './components/SupportDetailsPanel';
import { useProfessionalWorldsQuota } from './hooks/useProfessionalWorldsQuota';
import type { ProfessionalRuntimeAiAction } from './types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

function parsePayload(
	text: string,
	invalidPayloadMessage: string
): Record<string, unknown> {
	const parsed = JSON.parse(text) as unknown;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(invalidPayloadMessage);
	}
	return parsed as Record<string, unknown>;
}

function buildInitialPayload(
	action: ProfessionalRuntimeAiAction | undefined,
	sampleInstruction: string
) {
	return JSON.stringify(
		{
			action_key: action?.action_key ?? '',
			context: {},
			instruction: sampleInstruction,
		},
		null,
		2
	);
}

function actionSafetyWarnings(
	action: ProfessionalRuntimeAiAction | undefined,
	defaultWarning: string
) {
	if (!action) {
		return [];
	}
	const warnings = action.safety_warnings ?? [];
	if (action.risk_level === 'high' && warnings.length === 0) {
		return [defaultWarning];
	}
	return warnings;
}

export function AiActionLauncher({
	actions,
	moduleKey,
	onLaunch,
	verticalSlug,
}: {
	actions: ProfessionalRuntimeAiAction[];
	moduleKey?: string;
	verticalSlug?: string;
	onLaunch: (
		action: ProfessionalRuntimeAiAction,
		payload: Record<string, unknown>
	) => void | Promise<void>;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const quotaEnabled = verticalSlug === PROFESSIONAL_WORLDS_VERTICAL_REALTOR;
	const {
		summary,
		loading: quotaLoading,
		error: quotaError,
	} = useProfessionalWorldsQuota({ enabled: quotaEnabled });
	const visibleActions = useMemo(
		() =>
			moduleKey
				? actions.filter((action) => action.module_key === moduleKey)
				: actions,
		[actions, moduleKey]
	);
	const [selectedActionKey, setSelectedActionKey] = useState(
		visibleActions[0]?.action_key ?? ''
	);
	const selectedAction =
		visibleActions.find((action) => action.action_key === selectedActionKey) ??
		visibleActions[0];
	const safetyWarnings = actionSafetyWarnings(
		selectedAction,
		t('runtimeComponents.aiActionLauncher.defaultHighRiskWarning')
	);
	const [payloadText, setPayloadText] = useState(() =>
		buildInitialPayload(
			selectedAction,
			t('runtimeComponents.aiActionLauncher.sampleInstruction')
		)
	);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (visibleActions.length === 0) {
		return (
			<DesktopAppEmptyState
				title={t('runtimeComponents.aiActionLauncher.emptyTitle')}
				description={t('runtimeComponents.aiActionLauncher.emptyDescription')}
			/>
		);
	}

	async function handleLaunch() {
		if (!selectedAction) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onLaunch(
				selectedAction,
				parsePayload(
					payloadText,
					t('runtimeComponents.aiActionLauncher.invalidPayload')
				)
			);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: t('runtimeComponents.aiActionLauncher.launchFailed')
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('runtimeComponents.aiActionLauncher.title')}
		>
			<select
				value={selectedAction?.action_key ?? ''}
				onChange={(event) => {
					const nextAction = visibleActions.find(
						(action) => action.action_key === event.target.value
					);
					setSelectedActionKey(event.target.value);
					setPayloadText(
						buildInitialPayload(
							nextAction,
							t('runtimeComponents.aiActionLauncher.sampleInstruction')
						)
					);
				}}
				className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
			>
				{visibleActions.map((action) => (
					<option key={action.action_key} value={action.action_key}>
						{action.display_name}
					</option>
				))}
			</select>
			{selectedAction?.description && (
				<p className="text-xs text-(--desktop-text-secondary)">
					{selectedAction.description}
				</p>
			)}
			{(selectedAction?.risk_level === 'high' || safetyWarnings.length > 0) && (
				<ProfessionalWorldsStatusBanner kind="warning" role="alert">
					<strong className="block font-semibold">
						{t('runtimeComponents.aiActionLauncher.highRiskTitle')}
					</strong>
					<ul className="mt-1 grid gap-1">
						{safetyWarnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</ProfessionalWorldsStatusBanner>
			)}
			<SupportDetailsPanel
				className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-2"
				summaryClassName="text-xs font-medium text-(--desktop-text-secondary)"
				contentClassName="grid gap-2"
				summary={t('runtimeComponents.aiActionLauncher.advancedSummary')}
			>
				<p className="text-[11px] leading-relaxed text-(--desktop-text-muted)">
					{t('runtimeComponents.aiActionLauncher.payloadHint')}
				</p>
				<textarea
					aria-label={t('runtimeComponents.aiActionLauncher.payloadAria')}
					value={payloadText}
					onChange={(event) => setPayloadText(event.target.value)}
					className="min-h-40 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 font-mono text-xs text-(--desktop-text-primary)"
				/>
			</SupportDetailsPanel>
			{error ? (
				<ProfessionalWorldsStatusBanner kind="error">
					{error}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{quotaEnabled ? (
				<ProfessionalWorldsQuotaEstimate
					loading={quotaLoading}
					error={quotaError}
					summary={summary}
					showBalanceSummary
				/>
			) : null}
			<DesktopAppButton
				disabled={busy || !selectedAction}
				onClick={() => void handleLaunch()}
			>
				{t('runtimeComponents.aiActionLauncher.runAction')}
			</DesktopAppButton>
		</ProfessionalWorldsWorkspacePanel>
	);
}
