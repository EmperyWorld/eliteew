/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWA companion admin panel: Tools catalog + Action/Chat workflows + Task runs debug (WF-5/6).
 *
 * Invariants:
 * - Write actions require backend ``EWA_COMPANION_ADMIN_WRITE=1`` and PG catalog flag; UI mirrors via ``ewaCompanionAdminWriteGate``.
 * - All tabs surface API load errors (503/403), not silent empty lists.
 *
 * Related:
 * - src/pages/Admin/UnifiedAdminPage.tsx
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '@/pages/Desktop/constants';
import { EwaCompanionActionWorkflowsTab } from './EwaCompanionActionWorkflowsTab';
import { EwaCompanionAdminCatalogFrame } from './ewaCompanionAdminCatalogFrame';
import {
	fetchEwaCompanionAdminStatus,
	fetchEwaCompanionChatWorkflows,
	fetchEwaCompanionToolCatalog,
} from './ewaCompanionAdminApi';
import { isEwaCompanionWorkflowWriteEnabled } from './ewaCompanionAdminWriteGate';
import { EwaCompanionPromptsTab } from './EwaCompanionPromptsTab';
import { EwaCompanionSettingsTab } from './EwaCompanionSettingsTab';
import { EwaCompanionTaskRunsTab } from './EwaCompanionTaskRunsTab';
import { EwaCompanionToolsTab } from './EwaCompanionToolsTab';
import { EwaCompanionUsersTab } from './EwaCompanionUsersTab';
import { AdminSectionFrame } from '@/pages/Admin/shell/AdminSectionFrame';

type AdminTab =
	| 'tools'
	| 'actionWorkflows'
	| 'chatWorkflows'
	| 'taskRuns'
	| 'prompts'
	| 'users'
	| 'settings';

function AdminStatusHints({
	adminEnabled,
	writeEnabled,
	pgCatalogEnabled,
	onOpenSettings,
}: {
	adminEnabled: boolean;
	writeEnabled: boolean;
	pgCatalogEnabled: boolean;
	onOpenSettings: () => void;
}) {
	const { t } = useTranslation('desktopUi');
	const hints: string[] = [];
	if (!adminEnabled) {
		hints.push(t('ewaCompanionAdmin.statusAdminOff'));
	}
	if (!writeEnabled || !pgCatalogEnabled) {
		hints.push(t('ewaCompanionAdmin.statusWriteOff'));
	}
	if (hints.length === 0) {
		return null;
	}
	return (
		<div className="mb-4 space-y-2">
			{hints.map((hint) => (
				<div
					key={hint}
					className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
				>
					<p>{hint}</p>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} mt-2 bg-amber-500/20 px-3 py-1 text-xs text-amber-50 hover:bg-amber-500/30`}
						onClick={onOpenSettings}
					>
						{t('ewaCompanionAdmin.statusOpenSettings')}
					</button>
				</div>
			))}
		</div>
	);
}

function ChatWorkflowsPanel() {
	const { t, i18n } = useTranslation('desktopUi');
	const isRu = i18n.language?.startsWith('ru') ?? true;
	const query = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'chat-workflows'],
		queryFn: fetchEwaCompanionChatWorkflows,
		retry: false,
	});
	const rows = query.data?.workflows ?? [];

	return (
		<EwaCompanionAdminCatalogFrame
			isLoading={query.isLoading}
			error={query.error}
			empty={!query.isLoading && !query.error && rows.length === 0}
			loadingLabel={t('ewaCompanionAdmin.loadingChatWorkflows')}
			emptyLabel={t('ewaCompanionAdmin.emptyChatWorkflows')}
		>
			<div className="overflow-auto rounded-lg border border-white/10">
				<table className="min-w-full text-left text-sm text-(--desktop-text-primary)">
					<thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-(--desktop-text-muted)">
						<tr>
							<th className="px-3 py-2">{t('ewaCompanionAdmin.colId')}</th>
							<th className="px-3 py-2">{t('ewaCompanionAdmin.colTitle')}</th>
							<th className="px-3 py-2">
								{t('ewaCompanionAdmin.colDescription')}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.workflow_id} className="border-t border-white/5">
								<td className="px-3 py-2 font-mono text-xs">
									{row.workflow_id}
								</td>
								<td className="px-3 py-2">
									{isRu ? row.title_ru : row.title_en}
								</td>
								<td className="px-3 py-2 text-(--desktop-text-muted)">
									{isRu ? row.description_ru : row.description_en}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</EwaCompanionAdminCatalogFrame>
	);
}

export function EwaCompanionAdminPanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const queryClient = useQueryClient();
	const [tab, setTab] = useState<AdminTab>('tools');
	const [settingsFocusKey, setSettingsFocusKey] = useState<string | null>(null);
	const [taskRunsBridge, setTaskRunsBridge] = useState<{
		principalId: string;
		nonce: number;
	} | null>(null);

	const statusQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'status'],
		queryFn: fetchEwaCompanionAdminStatus,
		retry: false,
	});

	const toolsQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'tools'],
		queryFn: fetchEwaCompanionToolCatalog,
		retry: false,
		enabled: statusQuery.data?.admin_enabled !== false,
	});

	const sortedTools = useMemo(() => {
		const tools = toolsQuery.data?.tools ?? [];
		return [...tools].sort((a, b) => a.name.localeCompare(b.name));
	}, [toolsQuery.data?.tools]);

	const tabLabels: Record<AdminTab, string> = {
		tools: t('ewaCompanionAdmin.tabTools'),
		actionWorkflows: t('ewaCompanionAdmin.tabActionWorkflows'),
		chatWorkflows: t('ewaCompanionAdmin.tabChatWorkflows'),
		taskRuns: t('ewaCompanionAdmin.tabTaskRuns'),
		prompts: t('ewaCompanionAdmin.tabPrompts'),
		users: t('ewaCompanionAdmin.tabUsers'),
		settings: t('ewaCompanionAdmin.tabSettings'),
	};

	const refreshAll = () => {
		void queryClient.invalidateQueries({
			queryKey: ['ewa', 'admin', 'companion'],
		});
	};

	const workflowWriteEnabled = isEwaCompanionWorkflowWriteEnabled(
		statusQuery.data
	);

	const openPlatformSetting = (settingKey: string) => {
		setSettingsFocusKey(settingKey.trim());
		setTab('settings');
	};

	return (
		<AdminSectionFrame
			variant="full"
			className="flex h-full min-h-0 flex-col !py-4"
		>
			<div className="mb-4 flex flex-wrap items-center justify-end gap-2">
				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-(--desktop-text-primary) hover:bg-white/[0.1]`}
					onClick={refreshAll}
				>
					{t('ewaCompanionAdmin.refresh')}
				</button>
			</div>

			{statusQuery.data ? (
				<AdminStatusHints
					adminEnabled={statusQuery.data.admin_enabled}
					writeEnabled={statusQuery.data.admin_write_enabled}
					pgCatalogEnabled={statusQuery.data.pg_catalog_enabled}
					onOpenSettings={() => setTab('settings')}
				/>
			) : null}

			<nav
				className="mb-4 flex flex-wrap gap-2"
				aria-label={t('ewaCompanionAdmin.tabsAria')}
			>
				{(Object.keys(tabLabels) as AdminTab[]).map((id) => (
					<button
						key={id}
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
							tab === id
								? 'bg-[rgb(var(--desktop-accent-rgb)/0.3)] text-white ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
								: 'bg-white/[0.04] text-(--desktop-text-secondary) hover:bg-white/[0.08]'
						}`}
						onClick={() => setTab(id)}
					>
						{tabLabels[id]}
					</button>
				))}
			</nav>

			<div className="min-h-0 flex-1 overflow-auto">
				{tab === 'tools' ? (
					<EwaCompanionAdminCatalogFrame
						isLoading={toolsQuery.isLoading || statusQuery.isLoading}
						error={toolsQuery.error ?? statusQuery.error}
						empty={
							!toolsQuery.isLoading &&
							!toolsQuery.error &&
							sortedTools.length === 0
						}
						loadingLabel={t('ewaCompanionAdmin.loadingTools')}
						emptyLabel={t('ewaCompanionAdmin.emptyTools')}
					>
						<EwaCompanionToolsTab
							tools={sortedTools}
							routerRuntime={toolsQuery.data?.tool_router_runtime ?? null}
						/>
					</EwaCompanionAdminCatalogFrame>
				) : null}
				{tab === 'actionWorkflows' ? (
					<EwaCompanionActionWorkflowsTab
						workflowWriteEnabled={workflowWriteEnabled}
						onOpenSetting={openPlatformSetting}
					/>
				) : null}
				{tab === 'chatWorkflows' ? <ChatWorkflowsPanel /> : null}
				{tab === 'taskRuns' ? (
					<EwaCompanionTaskRunsTab
						key={
							taskRunsBridge
								? `${taskRunsBridge.principalId}:${taskRunsBridge.nonce}`
								: 'task-runs'
						}
						initialPrincipalId={taskRunsBridge?.principalId ?? null}
					/>
				) : null}
				{tab === 'prompts' ? (
					<EwaCompanionPromptsTab writeEnabled={workflowWriteEnabled} />
				) : null}
				{tab === 'users' ? (
					<EwaCompanionUsersTab
						writeEnabled={workflowWriteEnabled}
						onOpenTaskRuns={(principalId) => {
							setTaskRunsBridge({
								principalId,
								nonce: Date.now(),
							});
							setTab('taskRuns');
						}}
					/>
				) : null}
				{tab === 'settings' ? (
					<EwaCompanionSettingsTab
						focusSettingKey={settingsFocusKey}
						onFocusSettingKeyConsumed={() => setSettingsFocusKey(null)}
					/>
				) : null}
			</div>
		</AdminSectionFrame>
	);
}
