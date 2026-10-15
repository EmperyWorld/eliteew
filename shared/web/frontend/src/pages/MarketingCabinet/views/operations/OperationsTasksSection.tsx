/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet operations tasks panel: virtualized list, CRUD form, and
 * dashboard deep-link empty states.
 *
 * Invariants:
 * - Long task lists use windowed virtualization (MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD).
 * - Behavior matches pre-atomization OperationsView tasks branch.
 *
 * Related:
 * - OperationsView.tsx
 * - useOperationsView.ts
 */

import { VirtualVariableList } from '@/components/shared/VirtualList';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ClipboardDocumentListIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSurface,
} from '../../../Desktop/components/DesktopAppChrome';
import { DocumentAutofillAction } from '../../components/DocumentAutofillAction';
import { MarketingSectionGenerateAiButton } from '../../components/MarketingSectionGenerateAiButton';
import { InputLabel } from '../../components/FieldLabel';
import { LoadingGrid } from '../../components/LoadingGrid';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import { SectionPanel } from '../../components/SectionPanel';
import {
	INPUT_STACK_CLASS,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../../constants';
import {
	formatDateTime,
	localizePriority,
	localizeStatus,
} from '../../locales';
import type { MarketingTask } from '../../marketingCabinetApi';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../../marketingCabinetQueryOptions';
import { extractApiErrorMessage } from '../../utils';
import {
	getLocalizedTaskCopy,
	initialTaskForm,
	isTaskOverdue,
	taskPriorityBadgeClass,
	taskStatusBadgeClass,
} from './operationsHelpers';
import type { OperationsViewController } from './useOperationsView';

type OperationsTasksSectionProps = {
	ops: OperationsViewController;
	projectId: string;
};

export function OperationsTasksSection({
	ops,
	projectId,
}: OperationsTasksSectionProps) {
	const {
		t,
		focusedEntityId,
		allowMarketingWrite,
		taskStatusOptions,
		taskPriorityOptions,
		taskIds,
		taskForm,
		setTaskForm,
		editingTask,
		setEditingTask,
		tasksQuery,
		createTaskMutation,
		updateTaskMutation,
		deleteTaskMutation,
		taskItems,
		tasksTotal,
		tasksTruncated,
		sortedTasks,
		displayTasks,
	} = ops;

	const isPending =
		createTaskMutation.isPending || updateTaskMutation.isPending;

	const renderTaskRow = (task: MarketingTask) => {
		const displayTask = getLocalizedTaskCopy(task, t);
		const deletingThis =
			deleteTaskMutation.isPending && deleteTaskMutation.variables === task.id;
		return (
			<DesktopAppSurface
				variant="soft"
				data-marketing-entity-id={task.id}
				className={cn(
					'space-y-3 p-4 transition-[box-shadow,border-color]',
					'hover:border-(--desktop-border-strong)/70',
					focusedEntityId === task.id && 'ring-1 ring-(--mc-accent-60)'
				)}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
							{displayTask.title}
						</div>
						<div className="flex flex-wrap items-center gap-1.5">
							<span
								className={cn(
									'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
									taskStatusBadgeClass(task.status)
								)}
							>
								{localizeStatus(task.status)}
							</span>
							<span
								className={cn(
									'inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
									taskPriorityBadgeClass(task.priority)
								)}
							>
								{localizePriority(task.priority)}
							</span>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{task.owner_name || t('common.ownerUnset')}
							</span>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setEditingTask(task);
								setTaskForm({
									title: displayTask.title,
									description: displayTask.description || '',
									status: task.status || 'open',
									priority: task.priority || 'medium',
									owner_name: task.owner_name || '',
									due_at: task.due_at || '',
								});
							}}
						>
							{t('common.edit')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							disabled={deletingThis}
							onClick={() => deleteTaskMutation.mutate(task.id)}
							aria-label={t('operationsView.tasks.deleteAria', {
								name: displayTask.title,
							})}
						>
							{deletingThis ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<TrashIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
						</DesktopAppButton>
					</div>
				</div>
				{displayTask.description ? (
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						{displayTask.description}
					</p>
				) : null}
				<div
					className={cn(
						'tabular-nums',
						isTaskOverdue(task)
							? 'text-xs font-medium text-amber-200/95 antialiased'
							: DESKTOP_TYPOGRAPHY.meta
					)}
				>
					{t('operationsView.tasks.dueLine', {
						due: task.due_at
							? formatDateTime(task.due_at)
							: t('common.dueNotSet'),
					})}
				</div>
			</DesktopAppSurface>
		);
	};

	return (
		<div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
			<SectionPanel
				title={t('operationsView.tasks.panelTitle')}
				description={t('operationsView.tasks.panelDescription')}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						{allowMarketingWrite ? (
							<MarketingSectionGenerateAiButton
								projectId={projectId}
								targetSection="tasks"
								allowMarketingWrite={allowMarketingWrite}
								invalidateQueryKeys={[
									marketingCabinetProjectSectionInvalidationQueryKey(
										'tasks',
										projectId
									),
									marketingCabinetProjectDashboardInvalidationQueryKey(
										projectId
									),
								]}
							/>
						) : null}
						<DocumentAutofillAction
							projectId={projectId}
							targetSection="tasks"
							targetLabel={t('operationsView.tasks.docAutofillLabel')}
							invalidateQueryKeys={[
								marketingCabinetProjectSectionInvalidationQueryKey(
									'tasks',
									projectId
								),
								marketingCabinetProjectDashboardInvalidationQueryKey(projectId),
							]}
						/>
					</div>
				}
			>
				{tasksQuery.isLoading ? (
					<LoadingGrid />
				) : tasksQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							tasksQuery.error,
							t('operationsView.tasks.loadErrorDefault')
						)}
						onAction={() => void tasksQuery.refetch()}
					/>
				) : displayTasks.length > 0 ? (
					<>
						<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
							{tasksTruncated
								? t('cabinetPage.listFetchSummaryTruncated', {
										shown: taskItems.length,
										total: tasksTotal,
									})
								: t('cabinetPage.listFetchSummaryAll', {
										count: displayTasks.length,
									})}
						</p>
						{displayTasks.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<VirtualVariableList
								items={displayTasks}
								estimateSize={() => 160}
								getItemKey={(index) =>
									displayTasks[index]?.id ?? `task-${index}`
								}
								height={480}
								overscanCount={6}
								className="rounded-(--desktop-radius)"
								renderItem={(task) => (
									<div className="pb-3">{renderTaskRow(task)}</div>
								)}
							/>
						) : (
							<ul
								className="m-0 list-none space-y-3 p-0"
								aria-label={t('operationsView.tasks.panelTitle')}
							>
								{displayTasks.map((task) => (
									<li key={task.id}>{renderTaskRow(task)}</li>
								))}
							</ul>
						)}
					</>
				) : sortedTasks.length > 0 ? (
					<DesktopAppEmptyState
						className="rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/40 py-10"
						icon={
							<ClipboardDocumentListIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('operationsView.tasks.urlFilterEmptyTitle')}
						description={t('operationsView.tasks.urlFilterEmptyDescription')}
					/>
				) : (
					<DesktopAppEmptyState
						className="rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/40 py-10"
						icon={
							<ClipboardDocumentListIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('operationsView.tasks.emptyTitle')}
						description={t('operationsView.tasks.emptyDescription')}
					/>
				)}
			</SectionPanel>
			<SectionPanel
				title={
					editingTask
						? t('operationsView.tasks.formEditTitle')
						: t('operationsView.tasks.formNewTitle')
				}
				description={t('operationsView.tasks.formDescription')}
				className={cn(
					editingTask &&
						'ring-1 ring-(--mc-accent-50)/80 shadow-[0_0_0_1px_color-mix(in_srgb,var(--mc-accent)_18%,transparent)]'
				)}
			>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!taskForm.title.trim()) return;
						if (editingTask) {
							void updateTaskMutation.mutateAsync();
							return;
						}
						void createTaskMutation.mutateAsync();
					}}
					aria-busy={isPending}
				>
					<div className="space-y-2">
						<InputLabel htmlFor={taskIds.title} required>
							{t('operationsView.tasks.fieldTitle')}
						</InputLabel>
						<DesktopAppInput
							id={taskIds.title}
							value={taskForm.title}
							onChange={(event) =>
								setTaskForm((prev) => ({
									...prev,
									title: event.target.value,
								}))
							}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={taskIds.description}>
							{t('operationsView.tasks.fieldDescription')}
						</InputLabel>
						<textarea
							id={taskIds.description}
							className={TEXTAREA_CLASS}
							value={taskForm.description}
							onChange={(event) =>
								setTaskForm((prev) => ({
									...prev,
									description: event.target.value,
								}))
							}
						/>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={taskIds.status}>
								{t('operationsView.tasks.fieldStatus')}
							</InputLabel>
							<MarketingCabinetSelect
								id={taskIds.status}
								value={taskForm.status}
								onChange={(status) =>
									setTaskForm((prev) => ({ ...prev, status }))
								}
								options={taskStatusOptions}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={taskIds.priority}>
								{t('operationsView.tasks.fieldPriority')}
							</InputLabel>
							<MarketingCabinetSelect
								id={taskIds.priority}
								value={taskForm.priority}
								onChange={(priority) =>
									setTaskForm((prev) => ({ ...prev, priority }))
								}
								options={taskPriorityOptions}
							/>
						</div>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={taskIds.owner}>
								{t('operationsView.tasks.fieldOwner')}
							</InputLabel>
							<DesktopAppInput
								id={taskIds.owner}
								value={taskForm.owner_name}
								onChange={(event) =>
									setTaskForm((prev) => ({
										...prev,
										owner_name: event.target.value,
									}))
								}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={taskIds.due}>
								{t('operationsView.tasks.fieldDue')}
							</InputLabel>
							<DesktopAppInput
								id={taskIds.due}
								value={taskForm.due_at}
								onChange={(event) =>
									setTaskForm((prev) => ({
										...prev,
										due_at: event.target.value,
									}))
								}
								placeholder={t('operationsView.tasks.phDue')}
							/>
						</div>
					</div>
					{createTaskMutation.isError || updateTaskMutation.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								createTaskMutation.error || updateTaskMutation.error,
								t('operationsView.tasks.saveErrorDefault')
							)}
						/>
					) : null}
					<div className="flex items-center justify-end gap-2">
						{editingTask ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									setEditingTask(null);
									setTaskForm(initialTaskForm);
								}}
							>
								{t('common.cancel')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isPending || !taskForm.title.trim()}
						>
							{isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{editingTask
								? t('operationsView.tasks.submitSave')
								: t('operationsView.tasks.submitCreate')}
						</DesktopAppButton>
					</div>
				</form>
			</SectionPanel>
		</div>
	);
}
