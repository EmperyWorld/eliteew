/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin state panel for Desktop AI Chat hub (load error, permission denied).
 *
 * Related:
 * - features/desktop-ai-chat/layout/DesktopAiChatStatePanel.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { DesktopAiChatAdminLoadState } from './desktopAiChatAdminTypes';

type DesktopAiChatAdminStatePanelProps = {
	state: Extract<DesktopAiChatAdminLoadState, 'error' | 'permissionDenied'>;
	onRetry?: () => void;
	errorDetail?: string | null;
};

export function DesktopAiChatAdminStatePanel({
	state,
	onRetry,
	errorDetail,
}: DesktopAiChatAdminStatePanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const title =
		state === 'permissionDenied'
			? t('adminAiChat.state.permissionTitle')
			: t('adminAiChat.state.errorTitle');
	const description =
		state === 'permissionDenied'
			? t('adminAiChat.state.permissionDescription')
			: t('adminAiChat.state.errorDescription');

	return (
		<div
			className="rounded-lg border border-rose-500/35 bg-rose-950/25 px-4 py-4"
			role="alert"
		>
			<p className={`${DESKTOP_TYPOGRAPHY.subtitle} text-rose-100/95`}>
				{title}
			</p>
			<p className={`${DESKTOP_TYPOGRAPHY.body} mt-2 text-rose-100/80`}>
				{description}
			</p>
			{errorDetail ? (
				<details className="mt-3">
					<summary
						className={`${DESKTOP_TYPOGRAPHY.caption} cursor-pointer text-rose-200/70`}
					>
						{t('adminAiChat.state.supportDetails')}
					</summary>
					<pre className="mt-2 max-h-32 overflow-auto rounded border border-rose-500/20 bg-black/30 p-2 font-mono text-xs text-rose-100/80">
						{errorDetail}
					</pre>
				</details>
			) : null}
			{onRetry && state === 'error' ? (
				<button
					type="button"
					onClick={onRetry}
					className="mt-3 inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-3 py-1.5 text-sm text-rose-50 hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
				>
					<ArrowPathIcon className="h-4 w-4" aria-hidden />
					{t('adminAiChat.state.retry')}
				</button>
			) : null}
		</div>
	);
}
