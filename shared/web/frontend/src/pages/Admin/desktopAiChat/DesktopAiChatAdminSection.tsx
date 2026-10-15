/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tabbed Desktop AI Chat admin hub as a dedicated Unified Admin section.
 *
 * Invariants:
 * - Sub-tab deep links use `?section=desktopAiChat&aiChatTab=` when URL sync is enabled.
 *
 * Related:
 * - pages/Admin/UnifiedAdminPage.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import {
	DesktopAiChatAdminProvider,
	useDesktopAiChatAdmin,
} from './DesktopAiChatAdminContext';
import { DesktopAiChatAdminStatePanel } from './DesktopAiChatAdminStatePanel';
import { DesktopAiChatDefaultsTab } from './DesktopAiChatDefaultsTab';
import { DesktopAiChatMemoryCellsTab } from './DesktopAiChatMemoryCellsTab';
import { DesktopAiChatOverviewTab } from './DesktopAiChatOverviewTab';
import { DesktopAiChatAdminProbePanel } from './DesktopAiChatAdminProbePanel';
import { DesktopAiChatBlueprintTab } from './DesktopAiChatBlueprintTab';
import { DesktopAiChatTemplatesTab } from './DesktopAiChatTemplatesTab';
import type { DesktopAiChatAdminTab } from './desktopAiChatAdminTypes';
import {
	readDesktopAiChatAdminTabFromUrl,
	syncDesktopAiChatAdminTabToUrl,
} from './desktopAiChatAdminUrl';

export interface DesktopAiChatAdminSectionProps {
	urlSyncEnabled?: boolean;
}

function DesktopAiChatAdminSectionBody({
	urlSyncEnabled = true,
}: DesktopAiChatAdminSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('desktopAiChat');
	const { loadState, loadErrorDetail, refresh, saveState } =
		useDesktopAiChatAdmin();
	const [tab, setTab] = React.useState<DesktopAiChatAdminTab>(() => {
		if (typeof window === 'undefined') return 'overview';
		return readDesktopAiChatAdminTabFromUrl() ?? 'overview';
	});

	const selectTab = React.useCallback(
		(next: DesktopAiChatAdminTab) => {
			setTab(next);
			syncDesktopAiChatAdminTabToUrl(next, { enabled: urlSyncEnabled });
		},
		[urlSyncEnabled]
	);

	const tabLabels: Record<DesktopAiChatAdminTab, string> = {
		overview: t('adminAiChat.tabOverview'),
		defaults: t('adminAiChat.tabDefaults'),
		memoryCells: t('adminAiChat.tabMemoryCells'),
		blueprint: t('adminAiChat.tabBlueprint'),
		templates: t('adminAiChat.tabTemplates'),
		diagnostics: t('adminAiChat.tabDiagnostics'),
	};

	const tabOrder: DesktopAiChatAdminTab[] = [
		'overview',
		'defaults',
		'memoryCells',
		'blueprint',
		'templates',
		'diagnostics',
	];

	const onTabKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		id: DesktopAiChatAdminTab
	) => {
		const idx = tabOrder.indexOf(id);
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			selectTab(tabOrder[(idx + 1) % tabOrder.length]);
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			selectTab(tabOrder[(idx - 1 + tabOrder.length) % tabOrder.length]);
		}
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col !py-4"
		>
			<h2 id={metaShell.headerTitleId} className="sr-only">
				{t('adminShell.sections.desktopAiChat')}
			</h2>

			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div
					className="flex flex-wrap gap-2"
					role="tablist"
					aria-label={t('adminAiChat.tabsAria')}
				>
					{tabOrder.map((id) => (
						<button
							key={id}
							type="button"
							role="tab"
							id={`dac-admin-tab-${id}`}
							aria-selected={tab === id}
							aria-controls={`dac-admin-panel-${id}`}
							tabIndex={tab === id ? 0 : -1}
							onKeyDown={(e) => onTabKeyDown(e, id)}
							className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
								tab === id
									? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
									: 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
							}`}
							onClick={() => selectTab(id)}
						>
							{tabLabels[id]}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => void refresh()}
					disabled={loadState === 'loading' || saveState === 'saving'}
					aria-busy={loadState === 'loading'}
					className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
				>
					<ArrowPathIcon
						className={`h-4 w-4 ${loadState === 'loading' ? 'animate-spin' : ''}`}
						aria-hidden
					/>
					{t('adminAiChat.refresh')}
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto">
				{loadState === 'loading' ? (
					<div
						className="space-y-3 py-2"
						role="status"
						aria-busy="true"
						aria-label={t('adminAiChat.loading')}
					>
						<div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-white/10" />
						<div className="h-40 w-full animate-pulse rounded-lg bg-white/[0.06]" />
					</div>
				) : null}

				{loadState === 'error' || loadState === 'permissionDenied' ? (
					<DesktopAiChatAdminStatePanel
						state={loadState}
						errorDetail={loadErrorDetail}
						onRetry={loadState === 'error' ? () => void refresh() : undefined}
					/>
				) : null}

				{loadState === 'ready' ? (
					<>
						{tab === 'overview' ? (
							<div
								id="dac-admin-panel-overview"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-overview"
							>
								<DesktopAiChatOverviewTab
									onOpenDefaults={() => selectTab('defaults')}
									onOpenMemoryCells={() => selectTab('memoryCells')}
									onOpenBlueprint={() => selectTab('blueprint')}
									onOpenDiagnostics={() => selectTab('diagnostics')}
								/>
							</div>
						) : null}
						{tab === 'defaults' ? (
							<div
								id="dac-admin-panel-defaults"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-defaults"
							>
								<DesktopAiChatDefaultsTab
									onOpenBlueprint={() => selectTab('blueprint')}
								/>
							</div>
						) : null}
						{tab === 'memoryCells' ? (
							<div
								id="dac-admin-panel-memoryCells"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-memoryCells"
							>
								<DesktopAiChatMemoryCellsTab />
							</div>
						) : null}
						{tab === 'blueprint' ? (
							<div
								id="dac-admin-panel-blueprint"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-blueprint"
							>
								<DesktopAiChatBlueprintTab />
							</div>
						) : null}
						{tab === 'templates' ? (
							<div
								id="dac-admin-panel-templates"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-templates"
							>
								<DesktopAiChatTemplatesTab />
							</div>
						) : null}
						{tab === 'diagnostics' ? (
							<div
								id="dac-admin-panel-diagnostics"
								role="tabpanel"
								aria-labelledby="dac-admin-tab-diagnostics"
							>
								<DesktopAiChatAdminProbePanel />
							</div>
						) : null}
					</>
				) : null}
			</div>
		</AdminSectionFrame>
	);
}

export function DesktopAiChatAdminSection({
	urlSyncEnabled = true,
}: DesktopAiChatAdminSectionProps): React.ReactElement {
	return (
		<DesktopAiChatAdminProvider>
			<DesktopAiChatAdminSectionBody urlSyncEnabled={urlSyncEnabled} />
		</DesktopAiChatAdminProvider>
	);
}
