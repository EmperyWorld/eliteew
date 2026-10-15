/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub task actions: view/download results, cancel, bulk delete/retry, export, clipboard.
 *
 * Invariants:
 * - Full result fetch uses ugsClient `/result/:id` with 5m in-memory cache facade.
 * - Unified content downloads use apiClient blob fetch (timeout not capped for large assets).
 * - User-visible toasts use `ugsHub.toast.*` via `useTranslation('ugsHub')`.
 *
 * Related:
 * - hooks/ugsHub/useUgsHubTaskCache.ts, ugsHubResultParsing.ts, i18n/locales en+ru ugsHub.json
 */

import type { JsonObject } from '@/types/common';
import { isAxiosError } from 'axios';
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { UGSTask } from '../api/useUgsDashboard';
import { apiClient } from '../../services/api/client';
import { log } from '../../utils/logger';
import {
	base64ToBlob,
	dataUriToBlob,
	extractAudioInfo,
	extractImageInfo,
	extractTextFromResult,
	isAudioType,
	isImageType,
	isLikelyTextResultType,
	needsResultFetch,
} from '../../components/UGS/hub/results/ugsHubResultParsing';
import type { UgsHubTaskCacheApi } from './useUgsHubTaskCache';

type ToastApi = {
	success: (title: string, message?: string) => void;
	error: (title: string, message?: string) => void;
	warning: (title: string, message?: string) => void;
	info: (title: string, message?: string) => void;
	action: (
		title: string,
		action: { label: string; onClick: () => void },
		message?: string
	) => void;
};

type UgsClient = {
	get: <T>(url: string) => Promise<{ data: T }>;
	delete: (url: string) => Promise<unknown>;
	post: (url: string, body: unknown) => Promise<unknown>;
};

export type UseUgsHubTaskActionsParams = {
	toast: ToastApi;
	taskCache: UgsHubTaskCacheApi;
	ugsClient: UgsClient;
	tasks: UGSTask[];
	filteredTasks: UGSTask[];
	selectedTasks: Set<string>;
	setSelectedResult: Dispatch<SetStateAction<UGSTask | null>>;
	setResultModalOpen: Dispatch<SetStateAction<boolean>>;
	setLoadingResult: Dispatch<SetStateAction<boolean>>;
	setSelectedTasks: Dispatch<SetStateAction<Set<string>>>;
	clearSelection: () => void;
	handleManualRefresh: () => Promise<void>;
	providerByType: Map<string, string>;
	providerDisplayByType: Map<string, string>;
};

export function useUgsHubTaskActions({
	toast,
	taskCache,
	ugsClient,
	tasks,
	filteredTasks,
	selectedTasks,
	setSelectedResult,
	setResultModalOpen,
	setLoadingResult,
	setSelectedTasks,
	clearSelection,
	handleManualRefresh,
	providerByType,
	providerDisplayByType,
}: UseUgsHubTaskActionsParams) {
	const { t } = useTranslation('ugsHub');

	const viewResult = useCallback(
		async (task: UGSTask, retryCount = 0) => {
			setSelectedResult(task);
			setResultModalOpen(true);

			if (needsResultFetch(task)) {
				const cached = taskCache.getCachedResult(task.id);
				if (cached) {
					const updatedTask: UGSTask = {
						...task,
						result: cached.data.result || task.result || null,
						result_preview:
							cached.data.result_preview || task.result_preview || null,
						metadata: cached.data.metadata || task.metadata || null,
					};
					setSelectedResult(updatedTask);
					return;
				}

				setLoadingResult(true);
				const maxRetries = 2;
				const retryDelay = 1000 * (retryCount + 1);

				try {
					const { data: payload } = await ugsClient.get<
						Pick<UGSTask, 'result' | 'result_preview' | 'metadata'>
					>(`/result/${task.id}`);

					taskCache.setCachedResult(task.id, payload);

					const updatedTask: UGSTask = {
						...task,
						result: payload.result || task.result || null,
						result_preview:
							payload.result_preview || task.result_preview || null,
						metadata: payload.metadata || task.metadata || null,
					};
					setSelectedResult(updatedTask);
					taskCache.mapTaskInList((existingTask) =>
						existingTask.id === task.id ? updatedTask : existingTask
					);
				} catch (error) {
					log.error('Error loading result:', error as unknown as string);

					if (isAxiosError(error)) {
						const isNetworkError =
							!error.response ||
							error.code === 'ECONNABORTED' ||
							error.code === 'ERR_NETWORK';
						const isServerError =
							error.response?.status && error.response.status >= 500;

						if ((isNetworkError || isServerError) && retryCount < maxRetries) {
							await new Promise((resolve) => setTimeout(resolve, retryDelay));
							return viewResult(task, retryCount + 1);
						}

						const detail =
							(error.response?.data as { detail?: string } | undefined)
								?.detail || t('toast.resultLoadFailed');
						toast.error(detail);
					} else {
						toast.error(t('toast.resultLoadFailed'));
					}
				} finally {
					setLoadingResult(false);
				}
			}
		},
		[
			taskCache,
			setLoadingResult,
			setResultModalOpen,
			setSelectedResult,
			t,
			toast,
			ugsClient,
		]
	);

	const downloadResult = useCallback(
		async (task: UGSTask) => {
			if (!task.result) {
				toast.error(t('toast.resultNotFound'));
				return;
			}

			try {
				const result = task.result;
				const typeKey = task.type_key;

				if (extractTextFromResult(result) || isLikelyTextResultType(typeKey)) {
					const content =
						extractTextFromResult(result) || JSON.stringify(result, null, 2);
					const blob = new Blob([content], { type: 'text/plain' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${typeKey}_${task.id}.txt`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					toast.success(t('toast.textDownloaded'));
				} else if (isImageType(typeKey)) {
					const imageInfo = extractImageInfo(result as JsonObject);
					const filename = imageInfo?.filename || `${typeKey}_${task.id}.png`;
					let blob: Blob | null = null;

					if (imageInfo?.unifiedContentId) {
						const { data } = await apiClient.get<Blob>(
							`/api/v1/content/${encodeURIComponent(imageInfo.unifiedContentId)}/download`,
							{ responseType: 'blob' }
						);
						blob = data;
					} else if (imageInfo?.src) {
						if (imageInfo.src.startsWith('data:')) {
							blob = dataUriToBlob(imageInfo.src);
						} else {
							const response = await fetch(imageInfo.src);
							blob = await response.blob();
						}
					} else if (imageInfo?.base64) {
						blob = base64ToBlob(
							imageInfo.base64,
							imageInfo.mime || 'image/png'
						);
					}

					if (!blob) {
						toast.error(t('toast.imageNotFound'));
						return;
					}

					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = filename;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					toast.success(t('toast.imageDownloaded'));
				} else if (isAudioType(typeKey)) {
					const audioInfo = extractAudioInfo(result as JsonObject);
					if (audioInfo?.unifiedContentId) {
						const { data } = await apiClient.get<Blob>(
							`/api/v1/content/${encodeURIComponent(audioInfo.unifiedContentId)}/download`,
							{ responseType: 'blob' }
						);
						const url = URL.createObjectURL(data);
						const a = document.createElement('a');
						a.href = url;
						a.download = audioInfo.filename || `${typeKey}_${task.id}.mp3`;
						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);
						URL.revokeObjectURL(url);
						toast.success(t('toast.audioDownloaded'));
					} else if (audioInfo?.src) {
						const response = await fetch(audioInfo.src);
						const blob = await response.blob();
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						a.download = audioInfo.filename || `${typeKey}_${task.id}.mp3`;
						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);
						URL.revokeObjectURL(url);
						toast.success(t('toast.audioDownloaded'));
					} else {
						toast.error(t('toast.audioNotFound'));
					}
				} else {
					const blob = new Blob([JSON.stringify(result, null, 2)], {
						type: 'application/json',
					});
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${typeKey}_${task.id}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					toast.success(t('toast.resultDownloaded'));
				}
			} catch (error) {
				log.error('ArrowDownTrayIcon error:', error as unknown as string);
				toast.error(t('toast.downloadFailed'));
			}
		},
		[t, toast]
	);

	const cancelTask = useCallback(
		async (task: UGSTask) => {
			if (
				task.status !== 'pending' &&
				task.status !== 'queued' &&
				task.status !== 'processing' &&
				task.status !== 'retrying'
			) {
				return;
			}
			try {
				await ugsClient.delete(`/cancel/${task.id}`);
				toast.success(t('toast.generationCancelled'));
				await taskCache.invalidateTasksList();
				await taskCache.refetchTasksList();
			} catch (err) {
				log.error('Cancel task failed:', err as unknown as string);
				const msg =
					isAxiosError(err) && err.response?.data
						? String(
								(err.response.data as { detail?: string }).detail ??
									t('toast.cancelFailed')
							)
						: t('toast.cancelFailed');
				toast.error(msg);
			}
		},
		[taskCache, t, toast, ugsClient]
	);

	const copyToClipboard = useCallback(
		async (content: string) => {
			try {
				await navigator.clipboard.writeText(content);
				toast.success(t('toast.copiedToClipboard'));
			} catch (_error) {
				toast.error(t('toast.copyFailed'));
			}
		},
		[t, toast]
	);

	const toggleTaskSelection = useCallback(
		(taskId: string) => {
			setSelectedTasks((prev) => {
				const newSet = new Set(prev);
				if (newSet.has(taskId)) {
					newSet.delete(taskId);
				} else {
					newSet.add(taskId);
				}
				return newSet;
			});
		},
		[setSelectedTasks]
	);

	const handleBulkDelete = useCallback(() => {
		if (selectedTasks.size === 0) {
			return;
		}

		const taskIdsToDelete = Array.from(selectedTasks);
		const count = taskIdsToDelete.length;

		toast.action(
			t('toast.bulkDeleteConfirm', { count }),
			{
				label: t('toast.bulkDeleteLabel'),
				onClick: async () => {
					taskCache.removeTasksFromList(taskIdsToDelete);
					clearSelection();

					try {
						const batchSize = 5;
						for (let i = 0; i < taskIdsToDelete.length; i += batchSize) {
							const batch = taskIdsToDelete.slice(i, i + batchSize);
							await Promise.allSettled(
								batch.map((taskId) =>
									ugsClient.delete(`/tasks/${taskId}`).catch((err) => {
										log.error(`Failed to delete task ${taskId}:`, err);
									})
								)
							);
						}
						log.info('[UGSHub] Bulk delete completed', String(count));
						toast.success(t('toast.bulkDeleted', { count }));
						await handleManualRefresh();
					} catch (error) {
						log.error(
							'[UGSHub] Bulk delete failed',
							error as unknown as string
						);
						await handleManualRefresh();
						toast.error(t('toast.bulkDeleteFailed'));
					}
				},
			},
			t('toast.bulkDeleteDetail')
		);
	}, [
		clearSelection,
		handleManualRefresh,
		selectedTasks,
		t,
		taskCache,
		toast,
		ugsClient,
	]);

	const handleBulkRetry = useCallback(async () => {
		if (selectedTasks.size === 0) {
			return;
		}

		const tasksToRetry = filteredTasks.filter(
			(t) => selectedTasks.has(t.id) && t.status === 'failed'
		);
		if (tasksToRetry.length === 0) {
			toast.error(t('toast.bulkRetryNoFailed'));
			return;
		}

		taskCache.updateTasksList((prev) =>
			prev.map((task) =>
				tasksToRetry.some((rt) => rt.id === task.id)
					? { ...task, status: 'queued' as const }
					: task
			)
		);
		clearSelection();

		try {
			const batchSize = 5;
			for (let i = 0; i < tasksToRetry.length; i += batchSize) {
				const batch = tasksToRetry.slice(i, i + batchSize);
				await Promise.allSettled(
					batch.map((task) =>
						ugsClient
							.post('/generate', {
								type_key: task.type_key,
								input_data: task.input_data,
								priority: task.priority,
							})
							.catch((err) => {
								log.error(`Failed to retry task ${task.id}:`, err);
							})
					)
				);
			}
			toast.success(t('toast.bulkRetried', { count: tasksToRetry.length }));
			await handleManualRefresh();
		} catch (_error) {
			await handleManualRefresh();
			toast.error(t('toast.bulkRetryFailed'));
		}
	}, [
		clearSelection,
		filteredTasks,
		handleManualRefresh,
		selectedTasks,
		t,
		taskCache,
		toast,
		ugsClient,
	]);

	const exportTasks = useCallback(
		(format: 'csv' | 'json' = 'json') => {
			const tasksToExport = filteredTasks.length > 0 ? filteredTasks : tasks;

			if (format === 'json') {
				const dataStr = JSON.stringify(tasksToExport, null, 2);
				const blob = new Blob([dataStr], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `ugs-tasks-${new Date().toISOString().split('T')[0]}.json`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success(t('toast.exportedJson', { count: tasksToExport.length }));
			} else {
				const headers = [
					t('csvExport.id'),
					t('csvExport.type'),
					t('csvExport.status'),
					t('csvExport.created'),
					t('csvExport.completed'),
					t('csvExport.channel'),
					t('csvExport.priority'),
					t('csvExport.error'),
				];
				const rows = tasksToExport.map((task) => [
					task.id,
					task.type_key,
					task.status,
					task.created_at || '',
					task.status === 'completed' || task.status === 'failed'
						? task.updated_at || ''
						: '',
					providerDisplayByType.get(task.type_key) ??
						providerByType.get(task.type_key) ??
						'unknown',
					String(task.priority || ''),
					task.error || '',
				]);

				const csvContent = [
					headers.join(','),
					...rows.map((row) =>
						row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
					),
				].join('\n');

				const blob = new Blob([`\ufeff${csvContent}`], {
					type: 'text/csv;charset=utf-8;',
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `ugs-tasks-${new Date().toISOString().split('T')[0]}.csv`;
				a.click();
				URL.revokeObjectURL(url);
				toast.success(t('toast.exportedCsv', { count: tasksToExport.length }));
			}
		},
		[filteredTasks, providerByType, providerDisplayByType, t, tasks, toast]
	);

	return {
		viewResult,
		downloadResult,
		cancelTask,
		copyToClipboard,
		handleBulkDelete,
		handleBulkRetry,
		exportTasks,
		toggleTaskSelection,
	};
}
