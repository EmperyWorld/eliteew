/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Queries, mutations, and selection state for EWDesk admin news section.
 *
 * Invariants:
 * - News list invalidates admin + desktop feed query keys on mutate success.
 *
 * Related:
 * - EwDeskAdminSection.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 */
import { normalizeApiError } from '@/services/api/error-handler';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	ewDeskNewsCountsQueryKey,
	ewDeskNewsInvalidationQueryKey,
} from '../../Desktop/components/ewDesk/ewDeskNewsQueryOptions';
import { useSyncDesktopThemeFromMain } from '../../Desktop/hooks/useSyncDesktopThemeFromMain';
import {
	adminCreateNews,
	adminDeleteNews,
	adminListNews,
	adminPolishNewsBody,
	adminUpdateNews,
	type CompanyNewsPostAdmin,
} from '../../Desktop/services/productDesktopApi';
import { consumeProfessionalWorldsEwDeskAdminDraft } from '../../../features/professional-worlds/desktop/professionalWorldsEwDeskAdminBridge';
import { reportProfessionalCrossAppDraftLifecycle } from '../../../features/professional-worlds/desktop/reportProfessionalCrossAppDraftLifecycle';

export function useEwDeskAdminSection() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDeskAdmin' });
	const qc = useQueryClient();
	const [title, setTitle] = React.useState('');
	const [body, setBody] = React.useState('');
	const [imageUrl, setImageUrl] = React.useState('');
	const [imageContentId, setImageContentId] = React.useState<string | null>(
		null
	);
	const [videoContentId, setVideoContentId] = React.useState<string | null>(
		null
	);
	const [audioContentId, setAudioContentId] = React.useState<string | null>(
		null
	);
	const [contentPickerOpen, setContentPickerOpen] = React.useState(false);
	const [videoPickerOpen, setVideoPickerOpen] = React.useState(false);
	const [audioPickerOpen, setAudioPickerOpen] = React.useState(false);
	const [publishAtCreate, setPublishAtCreate] = React.useState('');
	const [editingId, setEditingId] = React.useState<string | null>(null);
	const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
		null
	);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
		() => new Set()
	);
	const [bulkAiBusy, setBulkAiBusy] = React.useState(false);
	const [bulkAiProgress, setBulkAiProgress] = React.useState<{
		current: number;
		total: number;
	} | null>(null);
	const bulkSelectAllRef = React.useRef<HTMLInputElement>(null);
	const deleteModalPortalRef = React.useRef<HTMLDivElement>(null);
	const deleteModalDescId = React.useId();
	const pwCrossAppLinkIdRef = React.useRef<string | null>(null);
	const pwAdminDraftHydratedRef = React.useRef(false);

	useSyncDesktopThemeFromMain(Boolean(deleteTargetId), deleteModalPortalRef);

	React.useEffect(() => {
		if (pwAdminDraftHydratedRef.current) return;
		const bridged = consumeProfessionalWorldsEwDeskAdminDraft();
		if (!bridged) return;
		pwAdminDraftHydratedRef.current = true;
		pwCrossAppLinkIdRef.current = bridged.crossAppLinkId;
		setTitle(bridged.title);
		setBody(bridged.markdown);
	}, []);

	const listQuery = useQuery({
		queryKey: ['admin', 'ewdesk', 'news'],
		queryFn: adminListNews,
	});

	const invalidateNews = React.useCallback(async (): Promise<void> => {
		await qc.invalidateQueries({ queryKey: ['admin', 'ewdesk'] });
		await qc.invalidateQueries({ queryKey: ewDeskNewsInvalidationQueryKey() });
		await qc.invalidateQueries({ queryKey: ewDeskNewsCountsQueryKey() });
	}, [qc]);

	const createMut = useMutation({
		mutationFn: () =>
			adminCreateNews({
				title: title.trim(),
				body: body.trim(),
				...(videoContentId
					? { video_content_id: videoContentId }
					: imageContentId
						? { image_content_id: imageContentId }
						: { image_url: imageUrl.trim() || undefined }),
				...(audioContentId ? { audio_content_id: audioContentId } : {}),
				is_published: true,
				published_at: publishAtCreate.trim()
					? new Date(publishAtCreate).toISOString()
					: undefined,
			}),
		onSuccess: async (data) => {
			setTitle('');
			setBody('');
			setImageUrl('');
			setImageContentId(null);
			setVideoContentId(null);
			setAudioContentId(null);
			setPublishAtCreate('');
			const linkId = pwCrossAppLinkIdRef.current;
			if (linkId && data.is_published) {
				reportProfessionalCrossAppDraftLifecycle(linkId, 'published', {
					ewdesk_news_id: data.id,
				});
				pwCrossAppLinkIdRef.current = null;
			}
			toast.success(t('toastPublished'));
			await invalidateNews();
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const patchMut = useMutation({
		mutationFn: (p: { id: string; patch: Partial<CompanyNewsPostAdmin> }) =>
			adminUpdateNews(p.id, p.patch),
		onSuccess: async () => {
			setEditingId(null);
			toast.success(t('toastSaved'));
			await invalidateNews();
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const delMut = useMutation({
		mutationFn: (id: string) => adminDeleteNews(id),
		onSuccess: async () => {
			toast.success(t('toastDeleted'));
			await invalidateNews();
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const posts = listQuery.data ?? [];

	const runBulkAiRegenerate = React.useCallback(async () => {
		const ids = Array.from(selectedIds);
		if (ids.length === 0 || bulkAiBusy) return;
		setBulkAiBusy(true);
		setBulkAiProgress({ current: 0, total: ids.length });
		let ok = 0;
		let fail = 0;
		for (let i = 0; i < ids.length; i++) {
			const id = ids[i];
			const post = posts.find((p) => p.id === id);
			if (!post) {
				fail++;
				continue;
			}
			setBulkAiProgress({ current: i + 1, total: ids.length });
			try {
				const result = await adminPolishNewsBody({
					title: post.title,
					body: post.body,
				});
				await adminUpdateNews(id, {
					title: result.title?.trim() ? result.title.trim() : post.title,
					body: result.body,
				});
				ok++;
			} catch (e) {
				fail++;
				const n = normalizeApiError(e);
				console.error(
					'EWDesk bulk AI:',
					id,
					typeof n === 'string' ? n : n.message
				);
			}
		}
		setBulkAiBusy(false);
		setBulkAiProgress(null);
		await invalidateNews();
		setSelectedIds(new Set());
		if (fail === 0) {
			toast.success(t('bulkAiToastAllOk', { count: ok }));
		} else {
			toast.error(t('bulkAiToastPartial', { ok, fail }));
		}
	}, [selectedIds, bulkAiBusy, posts, invalidateNews, t]);

	const selectablePosts = React.useMemo(
		() => posts.filter((p) => editingId !== p.id),
		[posts, editingId]
	);

	const allSelectableSelected =
		selectablePosts.length > 0 &&
		selectablePosts.every((p) => selectedIds.has(p.id));

	React.useEffect(() => {
		const valid = new Set(posts.map((p) => p.id));
		setSelectedIds((prev) => {
			let changed = false;
			const next = new Set<string>();
			prev.forEach((id) => {
				if (valid.has(id)) next.add(id);
				else changed = true;
			});
			if (next.size !== prev.size) changed = true;
			return changed ? next : prev;
		});
	}, [posts]);

	React.useEffect(() => {
		const el = bulkSelectAllRef.current;
		if (!el) return;
		const n = selectedIds.size;
		const total = selectablePosts.length;
		el.indeterminate = n > 0 && n < total;
	}, [selectedIds, selectablePosts.length]);

	React.useEffect(() => {
		if (!deleteTargetId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setDeleteTargetId(null);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [deleteTargetId]);

	return {
		t,
		title,
		setTitle,
		body,
		setBody,
		imageUrl,
		setImageUrl,
		imageContentId,
		setImageContentId,
		videoContentId,
		setVideoContentId,
		audioContentId,
		setAudioContentId,
		contentPickerOpen,
		setContentPickerOpen,
		videoPickerOpen,
		setVideoPickerOpen,
		audioPickerOpen,
		setAudioPickerOpen,
		publishAtCreate,
		setPublishAtCreate,
		editingId,
		setEditingId,
		deleteTargetId,
		setDeleteTargetId,
		selectedIds,
		setSelectedIds,
		bulkAiBusy,
		bulkAiProgress,
		bulkSelectAllRef,
		deleteModalPortalRef,
		deleteModalDescId,
		listQuery,
		posts,
		createMut,
		patchMut,
		delMut,
		runBulkAiRegenerate,
		selectablePosts,
		allSelectableSelected,
	};
}
