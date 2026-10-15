/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sequential multi-file upload orchestration for Content Manager Pro with per-file queue state and retry.
 *
 * Invariants:
 * - Uploads run one file at a time; folder_item_id and tenancy scope come from caller context.
 * - Failed files remain in queue with status failed until retried or cleared.
 *
 * Related:
 * - ContentManagerPro.tsx, contentManagerUploadTarget.ts, contentApi.ts
 */
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import { notify } from '../../../notifications';
import { contentApi } from '../../../services/contentApi';
import { requestDesktopFolderLibraryCountsInvalidate } from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import { normalizeContentUploadFiles } from '../utils/normalizeContentUploadFiles';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

export type ContentManagerUploadQueueStatus =
	| 'pending'
	| 'uploading'
	| 'success'
	| 'failed';

export type ContentManagerUploadQueueItem = {
	id: string;
	file: File;
	status: ContentManagerUploadQueueStatus;
	errorMessage?: string;
	deduplicated?: boolean;
};

export type ContentManagerUploadBatch = {
	current: number;
	total: number;
} | null;

export type ContentManagerUploadScope = {
	folderItemId: string | null;
	companyId?: string | null;
	projectId?: string | null;
};

export type UseContentManagerUploadOrchestrationOptions = {
	t: TFunction<'contentManager'>;
	uploadScope: ContentManagerUploadScope;
	onUploadSuccess: () => void | Promise<void>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
};

function newQueueItemId(file: File, index: number): string {
	return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export function useContentManagerUploadOrchestration({
	t,
	uploadScope,
	onUploadSuccess,
	setError,
	setSuccess,
}: UseContentManagerUploadOrchestrationOptions) {
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadBatch, setUploadBatch] =
		useState<ContentManagerUploadBatch>(null);
	const [queue, setQueue] = useState<ContentManagerUploadQueueItem[]>([]);

	const uploadSingleFile = useCallback(
		async (
			file: File,
			index: number,
			total: number,
			onItemProgress: (percent: number) => void
		): Promise<{ ok: boolean; deduplicated?: boolean; error?: unknown }> => {
			const uploadQuery: Record<string, unknown> = {
				name: file.name,
				folder_item_id: uploadScope.folderItemId,
				...(uploadScope.companyId ? { company_id: uploadScope.companyId } : {}),
				...(uploadScope.projectId ? { project_id: uploadScope.projectId } : {}),
			};
			try {
				const created = await contentApi.uploadContent(file, uploadQuery, {
					onProgress: (p) => {
						if (total === 1) {
							onItemProgress(p);
						} else {
							onItemProgress(Math.round(((index + p / 100) / total) * 100));
						}
					},
				});
				return { ok: true, deduplicated: created.deduplicated_reused };
			} catch (err) {
				return { ok: false, error: err };
			}
		},
		[uploadScope]
	);

	const runUploadBatch = useCallback(
		async (items: ContentManagerUploadQueueItem[]) => {
			if (items.length === 0) {
				return;
			}

			setUploading(true);
			setUploadProgress(0);
			setError(null);
			const n = items.length;
			setUploadBatch(n > 1 ? { current: 1, total: n } : null);

			let failed = 0;
			let firstErr: unknown = null;
			let firstMsg = '';
			let dedupCount = 0;
			let ok = 0;

			try {
				for (let i = 0; i < n; i++) {
					const item = items[i];
					if (n > 1) {
						setUploadBatch({ current: i + 1, total: n });
					}
					setQueue((prev) =>
						prev.map((q) =>
							q.id === item.id
								? { ...q, status: 'uploading', errorMessage: undefined }
								: q
						)
					);

					const result = await uploadSingleFile(
						item.file,
						i,
						n,
						setUploadProgress
					);

					if (result.ok) {
						ok += 1;
						if (result.deduplicated) {
							dedupCount += 1;
						}
						setQueue((prev) =>
							prev.map((q) =>
								q.id === item.id
									? {
											...q,
											status: 'success',
											deduplicated: result.deduplicated,
										}
									: q
							)
						);
					} else {
						failed += 1;
						const msg = getApiErrorMessage(result.error);
						if (!firstErr) {
							firstErr = result.error;
							firstMsg = msg;
						}
						setQueue((prev) =>
							prev.map((q) =>
								q.id === item.id
									? { ...q, status: 'failed', errorMessage: msg }
									: q
							)
						);
					}
				}

				if (failed === 0) {
					if (n === 1 && dedupCount === 1) {
						setSuccess(
							t('pro.toast.uploadedDedup', { name: items[0].file.name })
						);
					} else {
						setSuccess(
							n === 1
								? t('pro.toast.uploaded', { name: items[0].file.name })
								: t('pro.toast.uploadedMany', { count: n })
						);
					}
					setTimeout(() => setSuccess(null), 3000);
				} else if (ok === 0) {
					const hint = getContentRecoveryHint('upload', firstErr, t);
					logUxError(
						'ContentManagerPro',
						'unified_content',
						'upload',
						firstErr instanceof Error ? firstErr : undefined,
						{ message: firstMsg, hint }
					);
					setError(firstMsg);
					notify.error(t('pro.notify.uploadFailed'), `${firstMsg}. ${hint}`, {
						duration: 6000,
					});
				} else {
					const hint = getContentRecoveryHint('upload', firstErr, t);
					notify.warning(
						t('pro.notify.uploadPartialTitle'),
						t('pro.notify.uploadPartialDesc', {
							ok,
							failed,
							detail: firstMsg,
							hint,
						}),
						{ duration: 8000 }
					);
					setSuccess(t('pro.toast.uploadedPartial', { ok, failed }));
					setTimeout(() => setSuccess(null), 5000);
				}

				if (ok > 0) {
					await onUploadSuccess();
					if (uploadScope.folderItemId) {
						requestDesktopFolderLibraryCountsInvalidate({
							folderIds: [uploadScope.folderItemId],
						});
					}
				}
			} finally {
				setUploading(false);
				setUploadProgress(0);
				setUploadBatch(null);
			}
		},
		[
			onUploadSuccess,
			setError,
			setSuccess,
			t,
			uploadScope.folderItemId,
			uploadSingleFile,
		]
	);

	const uploadFiles = useCallback(
		async (rawFiles: FileList | File[] | null | undefined) => {
			const list = normalizeContentUploadFiles(rawFiles);
			if (list.length === 0) {
				return;
			}

			const newItems: ContentManagerUploadQueueItem[] = list.map(
				(file, index) => ({
					id: newQueueItemId(file, index),
					file,
					status: 'pending' as const,
				})
			);
			setQueue((prev) => [...prev, ...newItems]);
			await runUploadBatch(newItems);
		},
		[runUploadBatch]
	);

	const retryFile = useCallback(
		async (itemId: string) => {
			const item = queue.find((q) => q.id === itemId);
			if (item?.status !== 'failed') {
				return;
			}
			await runUploadBatch([{ ...item, status: 'pending' }]);
		},
		[queue, runUploadBatch]
	);

	const clearQueue = useCallback(() => {
		setQueue((prev) => prev.filter((q) => q.status === 'uploading'));
	}, []);

	return {
		uploadFiles,
		uploading,
		uploadProgress,
		uploadBatch,
		queue,
		retryFile,
		clearQueue,
	};
}
