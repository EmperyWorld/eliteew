/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Content Manager metadata edit form state and persistence.
 *
 * Invariants:
 * - Empty names never reach the API.
 * - Friend-sharing fields are emitted only outside company/project tenancy.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - components/ContentManagerEditModal.tsx
 */
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { notify } from '../../../notifications';
import { contentApi } from '../../../services/contentApi';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import type { ContentManagerEditFormState } from '../components/ContentManagerEditModal';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

const EMPTY_FORM: ContentManagerEditFormState = {
	name: '',
	description: '',
	tags: '',
	visibility: 'private',
	folder_item_id: null,
	company_id: '',
	project_id: '',
	friend_visibility: false,
	friend_shared_user_ids: [],
};

export function useContentManagerEditForm({
	t,
	selectedContentId,
	fetchContent,
	fetchSelectedContentDetails,
	refreshProjects,
	setError,
	setSuccess,
}: {
	t: TFunction<'contentManager'>;
	selectedContentId: string | null;
	fetchContent: () => void | Promise<void>;
	fetchSelectedContentDetails: (id: string) => Promise<ContentItem>;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	setError: (value: string | null) => void;
	setSuccess: (value: string | null) => void;
}) {
	const [editItem, setEditItem] = useState<ContentItem | null>(null);
	const [editForm, setEditForm] =
		useState<ContentManagerEditFormState>(EMPTY_FORM);
	const [editNameError, setEditNameError] = useState<string | null>(null);
	const openEdit = useCallback(
		(item: ContentItem) => {
			setEditItem(item);
			setEditForm({
				name: item.name,
				description: item.description || '',
				tags: item.tags?.join(', ') || '',
				visibility: item.visibility,
				folder_item_id: item.folder_item_id ?? null,
				company_id: item.company_id ?? '',
				project_id: item.project_id ?? '',
				friend_visibility: item.friend_visibility ?? false,
				friend_shared_user_ids: (item.shared_with_user_ids ?? []).map(String),
			});
			setEditNameError(null);
			void refreshProjects(item.company_id ?? null);
		},
		[refreshProjects]
	);
	const updateFile = useCallback(async () => {
		if (!editItem) return;
		if (!editForm.name.trim()) {
			setEditNameError(t('pro.edit.nameRequired'));
			return;
		}
		setEditNameError(null);
		try {
			const body: Record<string, unknown> = {
				name: editForm.name,
				description: editForm.description,
				tags: editForm.tags
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean),
				visibility: editForm.visibility,
				folder_item_id: editForm.folder_item_id?.trim() || null,
				company_id: editForm.company_id.trim() || null,
				project_id: editForm.project_id.trim() || null,
			};
			if (!editForm.company_id.trim() && !editForm.project_id.trim()) {
				if (editForm.visibility === 'friends') {
					body.visibility =
						editForm.friend_shared_user_ids.length > 0 ? 'shared' : 'friends';
					body.friend_visibility = editForm.friend_shared_user_ids.length > 0;
					body.shared_with_user_ids = editForm.friend_shared_user_ids;
				} else if (editForm.visibility === 'shared') {
					body.friend_visibility = editForm.friend_visibility;
					body.shared_with_user_ids = editForm.friend_shared_user_ids;
				}
			}
			await contentApi.updateContent(editItem.id, body);
			setSuccess(t('pro.toast.saved'));
			setTimeout(() => setSuccess(null), 2000);
			setEditItem(null);
			await fetchContent();
			if (selectedContentId === editItem.id) {
				await fetchSelectedContentDetails(editItem.id);
			}
		} catch (error) {
			const message = getApiErrorMessage(error);
			const hint = getContentRecoveryHint('update', error, t);
			logUxError(
				'useContentManagerEditForm',
				'unified_content',
				'update',
				error instanceof Error ? error : undefined,
				{ message, hint }
			);
			setError(message);
			notify.error(t('pro.notify.saveFailed'), `${message}. ${hint}`, {
				duration: 6000,
			});
		}
	}, [
		editForm,
		editItem,
		fetchContent,
		fetchSelectedContentDetails,
		selectedContentId,
		setError,
		setSuccess,
		t,
	]);
	return {
		editItem,
		setEditItem,
		editForm,
		setEditForm,
		editNameError,
		setEditNameError,
		openEdit,
		updateFile,
	};
}
