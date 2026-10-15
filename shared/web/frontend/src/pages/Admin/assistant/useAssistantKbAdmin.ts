/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KB documents admin: queries, mutations, handbook sync, upload, and indexing poll.
 *
 * Invariants:
 * - KB index `product_assistant_kb` is separate from marketing/desktop chat RAG.
 * - Indexing poll stops when summary.indexing reaches zero after jobs were observed (`indexing > 0`).
 * - Completion toast uses warning when summary.error > 0; no completion toast if indexing never started.
 *
 * Related:
 * - pages/Admin/assistant/AssistantKbPanel.tsx
 * - documentation/product/PRODUCT-ASSISTANT-HANDBOOK.md
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	adminCreateKbDocument,
	adminDeleteKbDocument,
	adminGetKbDocument,
	adminGetKbSummary,
	adminListKbDocuments,
	adminPatchKbDocument,
	adminPurgeKbDocuments,
	adminReindexAllKbDocuments,
	adminReindexKbDocument,
	adminSyncHandbookKb,
	adminUploadKbDocument,
	adminUploadKbDocumentsBulk,
	getAssistantKbUploadLimits,
} from '../../Desktop/services/productDesktopApi';
import {
	filterKbDocuments,
	kbDocumentStatusOptions,
	sortKbDocumentsByUpdatedDesc,
} from '../../Desktop/utils/assistantKbSearch';
import { capAssistantKbUploadFiles } from '../assistantKbBulkUpload';

export type HandbookDryRunSnapshot = {
	dir: string;
	files: number;
	limit?: number;
};

export function useAssistantKbAdmin() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });
	const qc = useQueryClient();

	const kbQuery = useQuery({
		queryKey: ['admin', 'assistant', 'kb'],
		queryFn: adminListKbDocuments,
	});
	const kbSummaryQuery = useQuery({
		queryKey: ['admin', 'assistant', 'kb', 'summary'],
		queryFn: adminGetKbSummary,
		staleTime: 30_000,
		retry: 1,
	});
	const kbUploadLimitsQuery = useQuery({
		queryKey: ['admin', 'assistant', 'kb', 'upload-limits'],
		queryFn: getAssistantKbUploadLimits,
		staleTime: 60_000,
	});

	const [kbTitle, setKbTitle] = React.useState('');
	const [kbBody, setKbBody] = React.useState('');
	const [kbUploadTitle, setKbUploadTitle] = React.useState('');
	const [kbUploadFiles, setKbUploadFiles] = React.useState<File[]>([]);
	const [editKbId, setEditKbId] = React.useState<string | null>(null);
	const [kbJobPolling, setKbJobPolling] = React.useState(false);
	const [handbookSyncLimit, setHandbookSyncLimit] = React.useState('');
	const [lastHandbookDryRun, setLastHandbookDryRun] =
		React.useState<HandbookDryRunSnapshot | null>(null);
	const kbWasIndexingRef = React.useRef(false);
	const [kbListSearch, setKbListSearch] = React.useState('');
	const [kbStatusFilter, setKbStatusFilter] = React.useState<string | null>(
		null
	);

	const handbookSyncLimitParam = React.useMemo((): number | undefined => {
		const raw = handbookSyncLimit.trim();
		if (!raw) return undefined;
		const n = Number.parseInt(raw, 10);
		if (!Number.isFinite(n) || n < 1) return undefined;
		return Math.min(n, 500);
	}, [handbookSyncLimit]);

	const handbookSyncLimitToastPart = React.useMemo(() => {
		if (handbookSyncLimitParam == null) return '';
		return t('toastSyncHandbookLimitPart', { limit: handbookSyncLimitParam });
	}, [handbookSyncLimitParam, t]);

	const toastKbJobsComplete = React.useCallback(
		(summary: { indexed: number; error: number }) => {
			const payload = {
				indexed: summary.indexed,
				error: summary.error,
			};
			if (summary.error > 0) {
				toast.warning(t('toastKbJobsComplete', payload));
			} else {
				toast.success(t('toastKbJobsComplete', payload));
			}
		},
		[t]
	);

	React.useEffect(() => {
		if (!kbJobPolling) return;
		let active = true;
		const tick = async () => {
			if (!active) return;
			try {
				const summary = await qc.fetchQuery({
					queryKey: ['admin', 'assistant', 'kb', 'summary'],
					queryFn: adminGetKbSummary,
				});
				await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
				if (summary.indexing > 0) {
					kbWasIndexingRef.current = true;
				}
				if (summary.indexing === 0) {
					if (kbWasIndexingRef.current) {
						toastKbJobsComplete(summary);
						kbWasIndexingRef.current = false;
					}
					setKbJobPolling(false);
				}
			} catch (e: unknown) {
				setKbJobPolling(false);
				kbWasIndexingRef.current = false;
				toast.error(e instanceof Error ? e.message : String(e));
			}
		};
		void tick();
		const id = window.setInterval(() => void tick(), 2500);
		return () => {
			active = false;
			window.clearInterval(id);
		};
	}, [kbJobPolling, qc, toastKbJobsComplete]);

	const kbDetailQuery = useQuery({
		queryKey: ['admin', 'assistant', 'kb', 'detail', editKbId],
		queryFn: () => {
			if (!editKbId) {
				throw new Error('kb detail: editKbId is required');
			}
			return adminGetKbDocument(editKbId);
		},
		enabled: !!editKbId,
	});

	const createKbMut = useMutation({
		mutationFn: adminCreateKbDocument,
		onSuccess: async () => {
			setKbTitle('');
			setKbBody('');
			toast.success(t('toastKbAdded'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const reindexKbMut = useMutation({
		mutationFn: adminReindexKbDocument,
		onSuccess: async () => {
			toast.success(t('toastReindexed'));
			setKbJobPolling(true);
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const delKbMut = useMutation({
		mutationFn: adminDeleteKbDocument,
		onSuccess: async () => {
			toast.success(t('toastDocDeleted'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const purgeKbMut = useMutation({
		mutationFn: adminPurgeKbDocuments,
		onSuccess: async () => {
			toast.success(t('toastPurgeKbDone'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const reindexAllKbMut = useMutation({
		mutationFn: adminReindexAllKbDocuments,
		onSuccess: async () => {
			toast.success(t('toastReindexAllStarted'));
			setKbJobPolling(true);
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const syncHandbookMut = useMutation({
		mutationFn: () => adminSyncHandbookKb({ limit: handbookSyncLimitParam }),
		onSuccess: async (data) => {
			if (data.status === 'started') {
				toast.success(
					t('toastSyncHandbookStarted', {
						limitPart: handbookSyncLimitToastPart,
					})
				);
				setKbJobPolling(true);
			} else {
				toast.error(data.message?.trim() || t('toastError'));
			}
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) => {
			setKbJobPolling(false);
			kbWasIndexingRef.current = false;
			toast.error(e instanceof Error ? e.message : String(e));
		},
	});

	const syncHandbookDryRunMut = useMutation({
		mutationFn: () =>
			adminSyncHandbookKb({ dryRun: true, limit: handbookSyncLimitParam }),
		onSuccess: (data) => {
			toast.success(
				t('toastSyncHandbookDryRun', {
					files: data.files ?? 0,
					ok: data.ok ?? 0,
					fail: data.fail ?? 0,
					limitPart: handbookSyncLimitToastPart,
				})
			);
			if (data.handbook_dir?.trim()) {
				setLastHandbookDryRun({
					dir: data.handbook_dir.trim(),
					files: data.files ?? 0,
					...(handbookSyncLimitParam != null
						? { limit: handbookSyncLimitParam }
						: {}),
				});
				toast.message(
					t('toastSyncHandbookDryRunDir', { dir: data.handbook_dir })
				);
			}
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const uploadKbMut = useMutation({
		mutationFn: async (p: { files: File[]; title?: string }) => {
			if (p.files.length === 1) {
				const doc = await adminUploadKbDocument(p.files[0], p.title);
				return {
					ok: [doc],
					failed: [] as { filename: string; detail: string }[],
				};
			}
			return adminUploadKbDocumentsBulk(p.files);
		},
		onSuccess: async (data) => {
			setKbUploadFiles([]);
			setKbUploadTitle('');
			const nOk = data.ok.length;
			const nFail = data.failed.length;
			if (nFail === 0) {
				toast.success(
					nOk === 1
						? t('toastKbUploaded')
						: t('toastKbBulkUploaded', { count: nOk })
				);
			} else if (nOk === 0) {
				toast.error(t('toastKbBulkAllFailed', { count: nFail }));
			} else {
				toast.warning(t('toastKbBulkPartial', { ok: nOk, failed: nFail }));
			}
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const patchKbMut = useMutation({
		mutationFn: (p: { id: string; patch: { title?: string; body?: string } }) =>
			adminPatchKbDocument(p.id, p.patch),
		onSuccess: async () => {
			setEditKbId(null);
			toast.success(t('toastKbSaved'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant', 'kb'] });
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'summary'],
			});
			await qc.invalidateQueries({
				queryKey: ['admin', 'assistant', 'kb', 'detail'],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const kbDocuments = kbQuery.data ?? [];
	const kbStatusOptions = React.useMemo(
		() => kbDocumentStatusOptions(kbDocuments),
		[kbDocuments]
	);
	const filteredKbDocuments = React.useMemo(() => {
		const filtered = filterKbDocuments(
			kbDocuments,
			kbListSearch,
			kbStatusFilter
		);
		return sortKbDocumentsByUpdatedDesc(filtered);
	}, [kbDocuments, kbListSearch, kbStatusFilter]);

	const handleKbUploadFilesChange = React.useCallback(
		(files: File[]) => {
			const max = kbUploadLimitsQuery.data?.max_files ?? 256;
			const { accepted, dropped } = capAssistantKbUploadFiles(files, max);
			if (dropped > 0) {
				toast.warning(t('kbFilesCappedToast', { max }));
			}
			setKbUploadFiles(accepted);
			if (accepted.length > 1) {
				setKbUploadTitle('');
			}
		},
		[kbUploadLimitsQuery.data?.max_files, t]
	);

	return {
		kbQuery,
		kbSummaryQuery,
		kbUploadLimitsQuery,
		kbDetailQuery,
		kbDocuments,
		kbStatusOptions,
		filteredKbDocuments,
		kbTitle,
		setKbTitle,
		kbBody,
		setKbBody,
		kbUploadTitle,
		setKbUploadTitle,
		kbUploadFiles,
		handleKbUploadFilesChange,
		editKbId,
		setEditKbId,
		kbJobPolling,
		handbookSyncLimit,
		setHandbookSyncLimit,
		handbookSyncLimitParam,
		lastHandbookDryRun,
		kbListSearch,
		setKbListSearch,
		kbStatusFilter,
		setKbStatusFilter,
		createKb: createKbMut.mutate,
		isCreateKbPending: createKbMut.isPending,
		reindexKb: reindexKbMut.mutate,
		isReindexKbPending: reindexKbMut.isPending,
		deleteKb: delKbMut.mutate,
		isDeleteKbPending: delKbMut.isPending,
		purgeKb: purgeKbMut.mutate,
		isPurgeKbPending: purgeKbMut.isPending,
		reindexAllKb: reindexAllKbMut.mutate,
		isReindexAllKbPending: reindexAllKbMut.isPending,
		syncHandbook: syncHandbookMut.mutate,
		isSyncHandbookPending: syncHandbookMut.isPending,
		syncHandbookDryRun: syncHandbookDryRunMut.mutate,
		isSyncHandbookDryRunPending: syncHandbookDryRunMut.isPending,
		uploadKb: uploadKbMut.mutate,
		isUploadKbPending: uploadKbMut.isPending,
		patchKb: patchKbMut.mutate,
		isPatchKbPending: patchKbMut.isPending,
	};
}
