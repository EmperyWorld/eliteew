/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Professional Worlds state surface for journey-owned loading, empty, error,
 * permission, offline/stale, and long-running states.
 *
 * Invariants:
 * - Primary state copy is localized and human-readable; technical detail belongs in optional support disclosure.
 * - Error, permission, offline, stale, and long-running states expose live-region semantics.
 *
 * Related:
 * - ProfessionalWorldsRuntimeShell.tsx
 * - ProfessionalWorldsPanelErrorBoundary.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 * ---
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopProductStatePanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { SupportDetailsPanel } from '../components/SupportDetailsPanel';

export type ProfessionalWorldsJourneyState =
	| 'normal'
	| 'empty'
	| 'loading'
	| 'error'
	| 'permissionDenied'
	| 'offline'
	| 'stale'
	| 'longRunning';

const DESKTOP_STATE_BY_JOURNEY_STATE = {
	normal: 'ready',
	empty: 'empty',
	loading: 'loading',
	error: 'error',
	permissionDenied: 'permissionDenied',
	offline: 'offline',
	stale: 'offline',
	longRunning: 'loading',
} as const;

const LIVE_ROLE_BY_JOURNEY_STATE: Partial<
	Record<ProfessionalWorldsJourneyState, 'alert' | 'status'>
> = {
	error: 'alert',
	permissionDenied: 'alert',
	offline: 'status',
	stale: 'status',
	longRunning: 'status',
};

export function ProfessionalWorldsStatePanel({
	state,
	title,
	description,
	actions,
	onRetry,
	retryLabel,
	supportDetail,
	className,
	children,
}: {
	state: ProfessionalWorldsJourneyState;
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	onRetry?: () => void;
	retryLabel?: string;
	supportDetail?: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const defaultTitle = t(`statePanel.${state}.title`);
	const defaultDescription = t(`statePanel.${state}.description`);
	const retryAction = onRetry ? (
		<DesktopAppButton type="button" onClick={onRetry}>
			{retryLabel ?? t('statePanel.retry')}
		</DesktopAppButton>
	) : null;
	const stateActions =
		actions || retryAction ? (
			<>
				{actions}
				{retryAction}
			</>
		) : undefined;

	return (
		<DesktopProductStatePanel
			state={DESKTOP_STATE_BY_JOURNEY_STATE[state]}
			title={title ?? defaultTitle}
			description={description ?? defaultDescription}
			role={LIVE_ROLE_BY_JOURNEY_STATE[state]}
			aria-live={
				state === 'error' || state === 'permissionDenied'
					? 'assertive'
					: 'polite'
			}
			actions={stateActions}
			className={className}
		>
			{children}
			{supportDetail ? (
				<SupportDetailsPanel
					className="mt-3 w-full max-w-xl text-left"
					summary={t('statePanel.supportSummary')}
				>
					<div className="text-xs text-(--desktop-text-muted)">
						{supportDetail}
					</div>
				</SupportDetailsPanel>
			) : null}
		</DesktopProductStatePanel>
	);
}
