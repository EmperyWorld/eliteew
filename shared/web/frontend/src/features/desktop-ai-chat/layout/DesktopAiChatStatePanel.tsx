/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Desktop AI Chat state surface wrapper over DesktopProductStatePanel.
 *
 * Invariants:
 * - Primary copy uses desktopAiChat i18n; support detail stays optional behind disclosure.
 *
 * Related:
 * - desktopAiChatSurfaceState.ts, ProfessionalWorldsStatePanel.tsx
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopProductStatePanel,
} from '@/pages/Desktop/components/DesktopAppChrome';

export type DesktopAiChatJourneyState =
	| 'empty'
	| 'loading'
	| 'error'
	| 'permissionDenied'
	| 'offline'
	| 'ready';

const DESKTOP_STATE_BY_JOURNEY_STATE = {
	empty: 'empty',
	loading: 'loading',
	error: 'error',
	permissionDenied: 'permissionDenied',
	offline: 'offline',
	ready: 'ready',
} as const;

const LIVE_ROLE_BY_JOURNEY_STATE: Partial<
	Record<DesktopAiChatJourneyState, 'alert' | 'status'>
> = {
	error: 'alert',
	permissionDenied: 'alert',
	offline: 'status',
};

export function DesktopAiChatStatePanel({
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
	state: DesktopAiChatJourneyState;
	title?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	onRetry?: () => void;
	retryLabel?: string;
	supportDetail?: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	const { t } = useTranslation('desktopAiChat');
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
				<details className="mt-3 w-full max-w-xl text-left">
					<summary className="cursor-pointer text-xs text-(--desktop-text-muted)">
						{t('statePanel.supportSummary')}
					</summary>
					<div className="mt-2 text-xs text-(--desktop-text-muted)">
						{supportDetail}
					</div>
				</details>
			) : null}
		</DesktopProductStatePanel>
	);
}
