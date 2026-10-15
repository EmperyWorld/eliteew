/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Error/warning/empty states and WorkflowCard grid for the UGS Workflows tab.
 *
 * Invariants:
 * - Full-page load error hides toolbar + catalog; stale list still shows inline refresh error.
 *
 * Related:
 * - useUgsWorkflowsTabController.ts
 * - WorkflowCard.tsx
 * - UgsWorkflowsToolbar.tsx
 */

import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ExclamationTriangleIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUgsHubShellTheme } from '../hub/ugsHubShellThemeContext';
import type { ErrorResponse } from './types';
import type { UgsWorkflowsTabController } from './useUgsWorkflowsTabController';
import {
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
	workflowsCompactBtnClasses,
	workflowsEmptyHeroIconClasses,
	workflowsEmptyStateClasses,
	workflowsErrorAlertFullClasses,
	workflowsErrorAlertInlineClasses,
	workflowsErrorRetryBtnClasses,
	workflowsErrorRetryBtnCompactClasses,
	workflowsWarningAlertClasses,
	workflowsWarningDetailClasses,
} from './ugsWorkflowsSharedUi';
import { cn, formatRuntimeError, getErrorDetail } from './utils';
import WorkflowCard from './WorkflowCard';

export interface UgsWorkflowsListSectionProps {
	controller: UgsWorkflowsTabController;
	toolbar: ReactNode;
}

export function UgsWorkflowsListSection({
	controller,
	toolbar,
}: UgsWorkflowsListSectionProps): ReactElement {
	const { t } = useTranslation('ugsHub');
	const shellTheme = useUgsHubShellTheme();
	const {
		workflowsQuery,
		workflows,
		comfyuiStatus,
		filteredWorkflows,
		searchQuery,
		setSearchQuery,
		executionStateByWorkflowId,
		showExecutions,
		handleRefresh,
		handleImport,
		handleExecute,
		handleDuplicate,
		handleExport,
		handleDelete,
		toggleExecutions,
	} = controller;

	const fullPageError = workflowsQuery.isError && workflows.length === 0;

	return (
		<>
			{fullPageError && (
				<div
					role="alert"
					className={workflowsErrorAlertFullClasses(shellTheme)}
				>
					<ExclamationTriangleIcon
						className={cn(
							'mx-auto mb-3 h-10 w-10',
							shellTheme === 'light' ? 'text-rose-500' : 'text-rose-300'
						)}
						aria-hidden
					/>
					<h4
						className={cn(
							'text-base font-semibold',
							shellTheme === 'light' ? 'text-rose-950' : 'text-rose-50'
						)}
					>
						{t('workflows.loadErrorTitle')}
					</h4>
					<p
						className={cn(
							'mt-2 text-sm',
							shellTheme === 'light' ? 'text-rose-800' : 'text-rose-100/90'
						)}
					>
						{getErrorDetail(workflowsQuery.error as ErrorResponse) ||
							t('workflows.loadErrorFallback')}
					</p>
					<button
						type="button"
						onClick={() => {
							void handleRefresh();
						}}
						className={cn('mt-5', workflowsErrorRetryBtnClasses(shellTheme))}
					>
						<ArrowPathIcon className="h-4 w-4" aria-hidden />
						{t('workflows.retryLoad')}
					</button>
				</div>
			)}

			{workflowsQuery.isError && workflows.length > 0 && (
				<div
					role="alert"
					className={workflowsErrorAlertInlineClasses(shellTheme)}
				>
					<div className="flex min-w-0 items-start gap-2">
						<ExclamationTriangleIcon
							className={cn(
								'mt-0.5 h-5 w-5 shrink-0',
								shellTheme === 'light' ? 'text-rose-500' : 'text-rose-300'
							)}
							aria-hidden
						/>
						<span className="min-w-0">
							{t('workflows.staleRefreshError')}
							{getErrorDetail(workflowsQuery.error as ErrorResponse) ? (
								<span
									className={cn(
										'mt-1 block font-mono text-xs',
										shellTheme === 'light'
											? 'text-rose-800/90'
											: 'text-rose-100/85'
									)}
								>
									{getErrorDetail(workflowsQuery.error as ErrorResponse)}
								</span>
							) : null}
						</span>
					</div>
					<button
						type="button"
						onClick={() => {
							void handleRefresh();
						}}
						className={workflowsErrorRetryBtnCompactClasses(shellTheme)}
					>
						{t('workflows.retry')}
					</button>
				</div>
			)}

			{!fullPageError && (
				<>
					{workflows.some(
						(workflow) => workflow.workflow_source === 'comfyui_catalog'
					) &&
						comfyuiStatus &&
						!comfyuiStatus.available && (
							<div
								role="alert"
								className={workflowsWarningAlertClasses(shellTheme)}
							>
								<div className="flex items-start gap-3">
									<ExclamationTriangleIcon
										className={cn(
											'mt-0.5 h-5 w-5 shrink-0',
											shellTheme === 'light'
												? 'text-amber-600'
												: 'text-amber-300'
										)}
										aria-hidden
									/>
									<div className="min-w-0">
										<div
											className={cn(
												'font-semibold',
												shellTheme === 'light'
													? 'text-amber-950'
													: 'text-amber-50'
											)}
										>
											{t('workflows.comfyUnavailableTitle')}
										</div>
										<p
											className={cn(
												'mt-1',
												shellTheme === 'light'
													? 'text-amber-900'
													: 'text-amber-100'
											)}
										>
											{t('workflows.comfyUnavailableBody')}
										</p>
										{formatRuntimeError(t, comfyuiStatus.error) && (
											<p className={workflowsWarningDetailClasses(shellTheme)}>
												{formatRuntimeError(t, comfyuiStatus.error)}
											</p>
										)}
									</div>
								</div>
							</div>
						)}

					{toolbar}

					{filteredWorkflows.length === 0 ? (
						<div className={workflowsEmptyStateClasses(shellTheme)}>
							{searchQuery ? (
								<>
									<MagnifyingGlassIcon
										className={cn(
											'relative z-1 mx-auto mb-4 h-14 w-14',
											ugsHubTextMuted(shellTheme)
										)}
										strokeWidth={1.25}
										aria-hidden
									/>
									<h4
										className={cn(
											'relative z-1 mb-2 text-base font-semibold',
											ugsHubTextPrimary(shellTheme)
										)}
									>
										{t('workflows.emptySearchTitle')}
									</h4>
									<p
										className={cn(
											'relative z-1 mb-6 text-sm',
											ugsHubTextSecondary(shellTheme)
										)}
									>
										{t('workflows.emptySearchBody')}
									</p>
									<button
										type="button"
										onClick={() => setSearchQuery('')}
										className={workflowsCompactBtnClasses(shellTheme, 'create')}
									>
										{t('workflows.clearSearch')}
									</button>
								</>
							) : (
								<>
									<div
										className={workflowsEmptyHeroIconClasses(shellTheme)}
										aria-hidden
									>
										<Squares2X2Icon
											className={cn('h-14 w-14', ugsHubTextMuted(shellTheme))}
											strokeWidth={1.15}
										/>
										<SparklesIcon className="absolute -right-1 -top-1 h-9 w-9 text-amber-500/90 drop-shadow-md dark:text-amber-300/90" />
									</div>
									<h4
										className={cn(
											'relative z-1 mb-2 text-base font-semibold',
											ugsHubTextPrimary(shellTheme)
										)}
									>
										{t('workflows.emptyTitle')}
									</h4>
									<p
										className={cn(
											'relative z-1 mx-auto mb-6 max-w-md text-sm',
											ugsHubTextSecondary(shellTheme)
										)}
									>
										{t('workflows.emptyBody')}
									</p>
									<div className="relative z-1 flex flex-wrap items-center justify-center gap-3">
										<button
											type="button"
											onClick={handleImport}
											className={workflowsCompactBtnClasses(
												shellTheme,
												'import'
											)}
										>
											<ArrowUpTrayIcon width={16} height={16} aria-hidden />
											{t('workflows.importJson')}
										</button>
									</div>
								</>
							)}
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
							{filteredWorkflows.map((workflow) => {
								const executionState = executionStateByWorkflowId.get(
									workflow.id
								);
								return (
									<WorkflowCard
										key={workflow.id}
										workflow={workflow}
										executions={executionState?.executions}
										executionTotal={executionState?.total}
										showExecutions={Boolean(showExecutions[workflow.id])}
										comfyuiStatus={comfyuiStatus}
										onExecute={(record) => {
											void handleExecute(record);
										}}
										onToggleExecutions={toggleExecutions}
										onDuplicate={(record) => {
											void handleDuplicate(record);
										}}
										onExport={(record) => {
											void handleExport(record);
										}}
										onDelete={handleDelete}
									/>
								);
							})}
						</div>
					)}
				</>
			)}
		</>
	);
}
