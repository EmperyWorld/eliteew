/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Blueprint tab panel inside Desktop AI Chat admin hub (ensemble plan drafts).
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatAdminSection.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAiChatAdminStatePanel } from './DesktopAiChatAdminStatePanel';
import {
	DesktopAiChatBlueprintProvider,
	useDesktopAiChatBlueprint,
} from './DesktopAiChatBlueprintContext';
import { EnsemblePlanWorkbench } from './EnsemblePlanWorkbench';

function DesktopAiChatBlueprintTabBody(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const { loadState, loadErrorDetail, refresh } = useDesktopAiChatBlueprint();

	if (loadState === 'loading' || loadState === 'idle') {
		return (
			<div
				className="space-y-3 py-2"
				role="status"
				aria-busy="true"
				aria-label={t('adminAiChat.blueprint.loading')}
			>
				<div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-white/10" />
				<div className="h-40 w-full animate-pulse rounded-lg bg-white/[0.06]" />
			</div>
		);
	}

	if (loadState === 'error' || loadState === 'permissionDenied') {
		return (
			<DesktopAiChatAdminStatePanel
				state={loadState}
				errorDetail={loadErrorDetail}
				onRetry={loadState === 'error' ? () => void refresh() : undefined}
			/>
		);
	}

	return <EnsemblePlanWorkbench />;
}

export function DesktopAiChatBlueprintTab(): React.ReactElement {
	return (
		<DesktopAiChatBlueprintProvider>
			<DesktopAiChatBlueprintTabBody />
		</DesktopAiChatBlueprintProvider>
	);
}
