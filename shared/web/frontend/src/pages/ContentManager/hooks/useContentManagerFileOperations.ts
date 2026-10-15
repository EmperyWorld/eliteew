/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single-file download, reprocess, owned-archive export, and deep-link copy actions for Content Manager.
 *
 * Invariants:
 * - Concurrent download guard per content id; archive download is globally serialized.
 *
 * Related:
 * - ContentManagerPro.tsx, contentApi.ts
 */
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import { notify } from '../../../notifications';
import { contentApi } from '../../../services/contentApi';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import { buildContentManagerUrl } from '../../Desktop/utils/desktopDeepLink';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

export type UseContentManagerFileOperationsParams = {
	t: TFunction<'contentManager'>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
	fetchContent: () => void | Promise<void>;
	fetchSelectedContentDetails: (id: string) => Promise<unknown>;
	selectedContentId: string | null;
};

export function useContentManagerFileOperations({
	t,
	setError,
	setSuccess,
	fetchContent,
	fetchSelectedContentDetails,
	selectedContentId,
}: UseContentManagerFileOperationsParams) {
	const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
		null
	);
	const [downloadingOwnedArchive, setDownloadingOwnedArchive] = useState(false);
	const [ownedArchiveModalOpen, setOwnedArchiveModalOpen] = useState(false);

	const copyContentLink = useCallback(
		async (id: string) => {
			const url = buildContentManagerUrl(id);
			try {
				await navigator.clipboard.writeText(url);
				setSuccess(t('pro.toast.linkCopied'));
				setTimeout(() => setSuccess(null), 2000);
			} catch {
				setError(t('pro.toast.copyLinkFailed'));
			}
		},
		[t, setError, setSuccess]
	);

	const downloadFile = useCallback(
		async (id: string, name: string) => {
			if (downloadingFileId === id) return;
			setDownloadingFileId(id);
			try {
				notify.info(
					t('files.downloadPreparing', {
						defaultValue: 'Готовим скачивание...',
					}),
					name
				);
				await contentApi.downloadContent(id, name);
			} catch (err: unknown) {
				const status = (err as { response?: { status?: number } })?.response
					?.status;
				const msg =
					status === 404 ? t('errors.fileNotFound') : getApiErrorMessage(err);
				const hint = getContentRecoveryHint('download', err, t);
				logUxError(
					'ContentManagerPro',
					'unified_content',
					'download',
					err instanceof Error ? err : undefined,
					{ message: msg, hint }
				);
				setError(msg);
				notify.error(t('pro.notify.downloadFailed'), `${msg}. ${hint}`, {
					duration: 6000,
				});
			} finally {
				setDownloadingFileId((current) => (current === id ? null : current));
			}
		},
		[downloadingFileId, t, setError]
	);

	const reprocessContentDisplay = useCallback(
		async (id: string, name: string) => {
			try {
				await contentApi.reprocessContentDisplay(id);
				notify.success(
					t('pro.notify.reprocessQueuedTitle'),
					t('pro.notify.reprocessQueuedDesc', { name }),
					{ duration: 5000 }
				);
				await fetchContent();
				if (selectedContentId === id) {
					void fetchSelectedContentDetails(id);
				}
			} catch (err: unknown) {
				const msg = getApiErrorMessage(err);
				const hint = getContentRecoveryHint('update', err, t);
				logUxError(
					'ContentManagerPro',
					'unified_content',
					'reprocess',
					err instanceof Error ? err : undefined,
					{ message: msg, hint }
				);
				notify.error(t('pro.notify.reprocessFailedTitle'), `${msg}. ${hint}`, {
					duration: 6000,
				});
			}
		},
		[fetchContent, fetchSelectedContentDetails, selectedContentId, t]
	);

	const downloadOwnedArchive = useCallback(async () => {
		setDownloadingOwnedArchive(true);
		try {
			await contentApi.downloadOwnedArchive();
		} catch (err: unknown) {
			const msg = getApiErrorMessage(err);
			const hint = getContentRecoveryHint('batch', err, t);
			logUxError(
				'ContentManagerPro',
				'unified_content',
				'download_owned_archive',
				err instanceof Error ? err : undefined,
				{ message: msg, hint }
			);
			setError(msg);
			notify.error(t('pro.notify.zipFailed'), `${msg}. ${hint}`, {
				duration: 6000,
			});
		} finally {
			setDownloadingOwnedArchive(false);
		}
	}, [t, setError]);

	return {
		downloadingFileId,
		downloadingOwnedArchive,
		ownedArchiveModalOpen,
		setOwnedArchiveModalOpen,
		copyContentLink,
		downloadFile,
		reprocessContentDisplay,
		downloadOwnedArchive,
	} as const;
}
