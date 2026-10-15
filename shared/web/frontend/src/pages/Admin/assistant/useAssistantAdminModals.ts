/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Delete and bulk-action modal state for assistant admin (Escape dismiss, theme sync).
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/AssistantAdminDeleteModal.tsx
 * - pages/Admin/assistant/AssistantAdminBulkActionModal.tsx
 */
import * as React from 'react';
import { useSyncDesktopThemeFromMain } from '../../Desktop/hooks/useSyncDesktopThemeFromMain';

export type AssistantDeleteTarget =
	| null
	| { kind: 'kb'; id: string }
	| { kind: 'faq'; id: string };

export type AssistantBulkActionModal =
	| null
	| 'purge'
	| 'reindex'
	| 'sync-handbook';

export function useAssistantAdminModals() {
	const [deleteTarget, setDeleteTarget] =
		React.useState<AssistantDeleteTarget>(null);
	const [bulkActionModal, setBulkActionModal] =
		React.useState<AssistantBulkActionModal>(null);
	const deleteModalPortalRef = React.useRef<HTMLDivElement>(null);
	const bulkModalPortalRef = React.useRef<HTMLDivElement>(null);
	const deleteModalDescId = React.useId();
	const bulkModalDescId = React.useId();

	useSyncDesktopThemeFromMain(Boolean(deleteTarget), deleteModalPortalRef);
	useSyncDesktopThemeFromMain(Boolean(bulkActionModal), bulkModalPortalRef);

	React.useEffect(() => {
		if (!deleteTarget) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setDeleteTarget(null);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [deleteTarget]);

	React.useEffect(() => {
		if (!bulkActionModal) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setBulkActionModal(null);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [bulkActionModal]);

	return {
		deleteTarget,
		setDeleteTarget,
		bulkActionModal,
		setBulkActionModal,
		deleteModalPortalRef,
		bulkModalPortalRef,
		deleteModalDescId,
		bulkModalDescId,
	};
}
