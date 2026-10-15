/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro tasks panel: scheduled reminders plus CRM-suggested follow-ups from deals and clients.
 *
 * Invariants:
 * - Scheduled tasks load via REST; synthetic CRM rows are derived from snapshot deal/client next-action notes.
 * - Task delete requires confirm modal before DELETE; local list updates only after success.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export during Wave 3 split)
 * - ../../realtorLogic.ts
 * - ../../components/ProfessionalWorldsDeleteAction.tsx
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import { ProfessionalWorldsDeleteAction } from '../../components/ProfessionalWorldsDeleteAction';

import {
	createRealtorTask,
	deleteRealtorTask,
	listRealtorTasks,
	updateRealtorTask,
} from '../../api';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import {
	buildRealtorCrmFollowUpItems,
	resolveCrmFollowUpCommunicationFocus,
	resolveTaskCommunicationFocus,
} from '../../realtorLogic';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import type { RealtorTask } from '../../types';

type RealtorPanelTranslate = (
	key: string,
	options?: Record<string, unknown>
) => string;

function humanizeRealtorIdentifier(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatUnknownRealtorValue(
	t: RealtorPanelTranslate,
	value: string | null | undefined
): string {
	const humanValue = humanizeRealtorIdentifier(value?.trim() || '');
	return humanValue
		? t('realtorPro.formatters.customValue', { value: humanValue })
		: t('realtorPro.formatters.notSpecified');
}

function translateRealtorValue(
	t: RealtorPanelTranslate,
	key: string,
	fallback: string
): string {
	const value = t(key);
	return value === key ? fallback : value;
}

function formatTaskPriorityLabel(
	t: RealtorPanelTranslate,
	priority: string | null | undefined
): string {
	const normalized = priority?.trim() || 'normal';
	return translateRealtorValue(
		t,
		`realtorPro.tasks.priorities.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

function formatTaskStatusLabel(
	t: RealtorPanelTranslate,
	status: string | null | undefined
): string {
	const normalized = status?.trim() || 'open';
	return translateRealtorValue(
		t,
		`realtorPro.tasks.statuses.${normalized}`,
		formatUnknownRealtorValue(t, normalized)
	);
}

export function TasksPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		consumeTasksFocus,
		openClients,
		openCommunications,
		openPipeline,
		setSelectedPropertyId,
		tasksFocus,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const syntheticTasks = useMemo(
		() =>
			buildRealtorCrmFollowUpItems(snapshot.deals, snapshot.clients, {
				dealFallback: t('realtorPro.tasks.followUpDeal'),
				clientFallback: t('realtorPro.tasks.followUpClient'),
			}),
		[snapshot.clients, snapshot.deals, t]
	);
	const [scheduledTasks, setScheduledTasks] = useState<RealtorTask[]>([]);
	const [panelError, setPanelError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [newTitle, setNewTitle] = useState('');
	const [draftTaskLinks, setDraftTaskLinks] = useState<{
		property_id: string | null;
		client_id: string | null;
		deal_id: string | null;
	}>({ property_id: null, client_id: null, deal_id: null });
	const [busyId, setBusyId] = useState<string | null>(null);
	const [taskDeleteTarget, setTaskDeleteTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);

	const reloadStored = useCallback(async () => {
		setLoading(true);
		try {
			const rows = await listRealtorTasks();
			setScheduledTasks(
				[...rows].sort((a, b) => {
					const left = a.due_at ?? a.created_at ?? '';
					const right = b.due_at ?? b.created_at ?? '';
					return left.localeCompare(right);
				})
			);
			setPanelError(null);
		} catch (caught: unknown) {
			setPanelError(
				caught instanceof Error
					? caught.message
					: t('realtorPro.errors.unableToLoad')
			);
			setScheduledTasks([]);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void reloadStored();
	}, [reloadStored]);

	useEffect(() => {
		if (!tasksFocus) return;
		if (tasksFocus.draftTitle?.trim()) {
			setNewTitle(tasksFocus.draftTitle.trim());
		}
		setDraftTaskLinks({
			property_id: tasksFocus.propertyId?.trim() ?? null,
			client_id: tasksFocus.clientId?.trim() ?? null,
			deal_id: tasksFocus.dealId?.trim() ?? null,
		});
		if (tasksFocus.propertyId?.trim()) {
			setSelectedPropertyId(tasksFocus.propertyId.trim());
		}
		consumeTasksFocus();
	}, [consumeTasksFocus, setSelectedPropertyId, tasksFocus]);

	const handleCreate = useCallback(async () => {
		if (!newTitle.trim()) return;
		setBusyId('new');
		try {
			await createRealtorTask({
				title: newTitle.trim(),
				status: 'open',
				priority: 'normal',
				due_at: null,
				reminder_at: null,
				next_action: null,
				notes: null,
				property_id: draftTaskLinks.property_id,
				client_id: draftTaskLinks.client_id,
				showing_id: null,
				deal_id: draftTaskLinks.deal_id,
				task_meta: {},
			});
			setNewTitle('');
			setDraftTaskLinks({
				property_id: null,
				client_id: null,
				deal_id: null,
			});
			await reloadStored();
		} finally {
			setBusyId(null);
		}
	}, [draftTaskLinks, newTitle, reloadStored]);

	const handleMarkDone = useCallback(async (taskId: string) => {
		setBusyId(taskId);
		try {
			const updated = await updateRealtorTask(taskId, {
				status: 'done',
				clear_property: false,
				clear_client: false,
				clear_showing: false,
				clear_deal: false,
			});
			setScheduledTasks((current) =>
				current.map((item) => (item.id === taskId ? updated : item))
			);
		} finally {
			setBusyId(null);
		}
	}, []);

	const handleConfirmDeleteTask = useCallback(async () => {
		if (!taskDeleteTarget) return;
		setBusyId(taskDeleteTarget.id);
		try {
			await deleteRealtorTask(taskDeleteTarget.id);
			setScheduledTasks((current) =>
				current.filter((item) => item.id !== taskDeleteTarget.id)
			);
			setTaskDeleteTarget(null);
		} finally {
			setBusyId(null);
		}
	}, [taskDeleteTarget]);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.tasks.title')}
			className="grid gap-4 p-4"
		>
			{panelError ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{panelError}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<div className="grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{t('realtorPro.tasks.scheduledTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.tasks.scheduledHint')}
				</p>
				<div className="flex flex-wrap gap-2">
					<DesktopAppInput
						className="min-w-48"
						placeholder={t('realtorPro.tasks.newTaskPlaceholder')}
						value={newTitle}
						onChange={(event) => setNewTitle(event.target.value)}
					/>
					<DesktopAppButton
						disabled={busyId !== null || !newTitle.trim()}
						onClick={() => void handleCreate()}
					>
						{t('realtorPro.tasks.addTask')}
					</DesktopAppButton>
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => void reloadStored()}
					>
						{t('actions.refresh')}
					</DesktopAppButton>
				</div>
				{loading ? (
					<span className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.loading')}
					</span>
				) : scheduledTasks.length === 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.tasks.emptyScheduled')}
					</p>
				) : (
					<div className="grid gap-2">
						{scheduledTasks.map((task) => {
							const taskCommunicationFocus = resolveTaskCommunicationFocus(
								task,
								snapshot.showings ?? [],
								snapshot.deals,
								snapshot.properties
							);
							return (
								<article
									key={task.id}
									className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm text-(--desktop-text-primary)"
								>
									<strong>{task.title}</strong>
									<p className="mt-1 text-xs text-(--desktop-text-secondary)">
										{t('realtorPro.tasks.priorityLabel')}{' '}
										{formatTaskPriorityLabel(t, task.priority)} ·{' '}
										{t('realtorPro.tasks.tableStatus')}{' '}
										{formatTaskStatusLabel(t, task.status)}
									</p>
									<p className="mt-1 text-xs text-(--desktop-text-muted)">
										{t('realtorPro.tasks.duePrefix')}:{' '}
										{task.due_at
											? new Date(task.due_at).toLocaleString()
											: t('realtorPro.tasks.dueNotScheduled')}
									</p>
									<div className="mt-2 flex flex-wrap gap-2">
										{task.status !== 'done' ? (
											<DesktopAppButton
												size="sm"
												disabled={busyId === task.id}
												onClick={() => void handleMarkDone(task.id)}
											>
												{t('realtorPro.tasks.markDone')}
											</DesktopAppButton>
										) : null}
										{communicationsModuleEnabled && taskCommunicationFocus ? (
											<DesktopAppButton
												size="sm"
												variant="ghost"
												onClick={() =>
													openCommunications(taskCommunicationFocus)
												}
											>
												{t('realtorPro.communications.logCta')}
											</DesktopAppButton>
										) : null}
										<DesktopAppButton
											size="sm"
											variant="ghost"
											disabled={busyId === task.id}
											onClick={() =>
												setTaskDeleteTarget({
													id: task.id,
													title: task.title,
												})
											}
										>
											{t('realtorPro.tasks.deleteAction')}
										</DesktopAppButton>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>
			<div className="grid gap-2 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{t('realtorPro.tasks.crmSuggestedTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.tasks.crmSuggestedHint')}
				</p>
				{syntheticTasks.length === 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.tasks.emptyCrmSuggested')}
					</p>
				) : (
					<div className="grid gap-2">
						{syntheticTasks.map((task) => (
							<article
								key={task.id}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
							>
								<div className="flex items-center justify-between gap-2">
									<strong>{task.title}</strong>
									<span className="text-[11px] uppercase text-(--desktop-text-muted)">
										{task.source === 'deal'
											? t('realtorPro.tasks.crmKindDeal')
											: t('realtorPro.tasks.crmKindClient')}
									</span>
								</div>
								<div className="mt-2 flex flex-wrap gap-2">
									{task.source === 'deal' ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() => openPipeline({ dealId: task.entityId })}
										>
											{t('realtorPro.tasks.openDealInPipeline')}
										</DesktopAppButton>
									) : (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openClients({
													tab: 'directory',
													filterClientId: task.entityId,
												})
											}
										>
											{t('realtorPro.tasks.openClientDirectory')}
										</DesktopAppButton>
									)}
									{communicationsModuleEnabled ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openCommunications(
													resolveCrmFollowUpCommunicationFocus(task)
												)
											}
										>
											{t('realtorPro.communications.logCta')}
										</DesktopAppButton>
									) : null}
								</div>
							</article>
						))}
					</div>
				)}
			</div>
			<ProfessionalWorldsDeleteAction
				isOpen={taskDeleteTarget !== null}
				onClose={() => setTaskDeleteTarget(null)}
				onConfirm={handleConfirmDeleteTask}
				title={t('realtorPro.tasks.deleteTitle')}
				itemName={taskDeleteTarget?.title}
				warningMessage={t('realtorPro.tasks.deleteWarning')}
				confirmButtonLabel={t('realtorPro.tasks.deleteAction')}
			/>
		</ProfessionalWorldsWorkspacePanel>
	);
}
