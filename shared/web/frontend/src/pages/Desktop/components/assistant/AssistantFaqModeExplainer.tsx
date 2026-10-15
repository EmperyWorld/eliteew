/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dismissible one-line explainer for FAQ vs chat modes (plan R01).
 *
 * Invariants:
 * - Dismiss state stored in sessionStorage for the browser session.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 * - assistantChatConstants.ts ASSISTANT_MODE_EXPLAINER_DISMISS_KEY
 */
import { cn } from '@/utils/cn';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import { ASSISTANT_MODE_EXPLAINER_DISMISS_KEY } from './assistantChatConstants';

export type AssistantFaqModeExplainerProps = {
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantFaqModeExplainer({
	t,
}: AssistantFaqModeExplainerProps): React.ReactElement | null {
	const [dismissed, setDismissed] = React.useState(() => {
		try {
			return (
				sessionStorage.getItem(ASSISTANT_MODE_EXPLAINER_DISMISS_KEY) === '1'
			);
		} catch {
			return false;
		}
	});

	if (dismissed) return null;

	return (
		<div
			className={cn(
				'flex items-start gap-2 rounded-lg border border-(--desktop-border-subtle)/55',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_78%,transparent)]',
				'px-2.5 py-2',
				DESKTOP_TYPOGRAPHY.small,
				'text-(--desktop-text-secondary)'
			)}
			data-assistant-guide="faq-mode-explainer"
		>
			<InformationCircleIcon
				className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
				aria-hidden
			/>
			<p className="min-w-0 flex-1 leading-snug">{t('modeExplainer')}</p>
			<button
				type="button"
				className={cn(
					'shrink-0 rounded-md p-0.5 text-(--desktop-text-dim)',
					'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-label={t('modeExplainerDismiss')}
				onClick={() => {
					setDismissed(true);
					try {
						sessionStorage.setItem(ASSISTANT_MODE_EXPLAINER_DISMISS_KEY, '1');
					} catch {
						/* sessionStorage unavailable */
					}
				}}
			>
				<XMarkIcon className="h-4 w-4" aria-hidden />
			</button>
		</div>
	);
}
