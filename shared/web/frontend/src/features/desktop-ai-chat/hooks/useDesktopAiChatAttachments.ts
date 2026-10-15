/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Attachment upload/bind lifecycle for Desktop AI Chat (file picker, drag-drop, initial bind).
 *
 * Invariants:
 * - MAX_ATTACH_BATCH caps multi-file uploads; partial failures surface toast summaries.
 *
 * Related:
 * - DesktopAiChatApp.tsx, components/DesktopAiChatComposer.tsx, api/desktopChatClient.ts
 * ---
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	attachDesktopAiContent,
	listDesktopAiAttachments,
	uploadContentForChat,
	type DesktopAiAttachment,
} from '../api/desktopChatClient';

const MAX_ATTACH_BATCH = 32;

export type UseDesktopAiChatAttachmentsParams = {
	activeId: string | null;
	t: TFunction<'desktopAiChat'>;
	initialAttachUnifiedContentId?: string;
	initialAttachSourceLabel?: string | null;
};

export function useDesktopAiChatAttachments({
	activeId,
	t,
	initialAttachUnifiedContentId,
	initialAttachSourceLabel,
}: UseDesktopAiChatAttachmentsParams) {
	const [attachments, setAttachments] = React.useState<DesktopAiAttachment[]>(
		[]
	);
	const attachRef = React.useRef<HTMLInputElement>(null);
	const appliedDesktopAiInitialAttachRef = React.useRef(false);
	const warnedDesktopAttachNoChatRef = React.useRef(false);

	const refreshAttachments = React.useCallback(async () => {
		if (!activeId) {
			setAttachments([]);
			return;
		}
		try {
			const items = await listDesktopAiAttachments(activeId);
			setAttachments(items);
		} catch {
			setAttachments([]);
		}
	}, [activeId]);

	React.useEffect(() => {
		if (!activeId) {
			setAttachments([]);
			return;
		}
		void refreshAttachments();
	}, [activeId, refreshAttachments]);

	React.useEffect(() => {
		const cid = initialAttachUnifiedContentId?.trim();
		if (!cid || appliedDesktopAiInitialAttachRef.current || !activeId) {
			return;
		}
		appliedDesktopAiInitialAttachRef.current = true;
		void (async () => {
			try {
				const label =
					initialAttachSourceLabel?.trim() || t('attachFallbackName');
				const att = await attachDesktopAiContent(activeId, {
					content_id: cid,
					source_label: label,
				});
				if (att.rag_index_ok) {
					toast.success(t('attachIndexedToast', { name: label }));
				} else {
					toast.warning(t('attachNotIndexedToast', { name: label }));
				}
				void refreshAttachments();
			} catch {
				appliedDesktopAiInitialAttachRef.current = false;
				toast.error(t('attachFailedToast'));
			}
		})();
	}, [
		activeId,
		initialAttachUnifiedContentId,
		initialAttachSourceLabel,
		refreshAttachments,
		t,
	]);

	const attachSingleFile = React.useCallback(
		async (f: File) => {
			if (!activeId) {
				toast.error(t('selectChatFirst'));
				return;
			}
			try {
				const cid = await uploadContentForChat(f);
				const att = await attachDesktopAiContent(activeId, {
					content_id: cid,
					source_label: f.name,
				});
				if (att.rag_index_ok) {
					toast.success(t('attachIndexedToast', { name: f.name }));
				} else {
					toast.warning(t('attachNotIndexedToast', { name: f.name }));
				}
				void refreshAttachments();
			} catch {
				toast.error(t('attachFailedToast'));
			}
		},
		[activeId, refreshAttachments, t]
	);

	const attachMultipleFiles = React.useCallback(
		async (files: File[]) => {
			if (!files.length) {
				return;
			}
			if (!activeId) {
				toast.error(t('selectChatFirst'));
				return;
			}
			let list = files;
			if (list.length > MAX_ATTACH_BATCH) {
				toast.message(t('attachBatchLimit', { max: MAX_ATTACH_BATCH }));
				list = list.slice(0, MAX_ATTACH_BATCH);
			}
			if (list.length === 1) {
				const first = list[0];
				if (first) {
					await attachSingleFile(first);
				}
				return;
			}
			let ok = 0;
			let failed = 0;
			let indexed = 0;
			let notIndexed = 0;
			for (const f of list) {
				try {
					const cid = await uploadContentForChat(f);
					const att = await attachDesktopAiContent(activeId, {
						content_id: cid,
						source_label: f.name,
					});
					ok++;
					if (att.rag_index_ok) {
						indexed++;
					} else {
						notIndexed++;
					}
				} catch {
					failed++;
				}
			}
			void refreshAttachments();
			if (failed === 0) {
				toast.success(t('attachManyOk', { count: ok }));
			} else if (ok === 0) {
				toast.error(t('attachManyAllFailed', { count: failed }));
			} else {
				toast.warning(t('attachManyPartial', { ok, failed }));
			}
			if (notIndexed > 0 && ok > 0) {
				toast.warning(t('attachManySomeNotIndexed', { indexed, notIndexed }));
			}
		},
		[activeId, attachSingleFile, refreshAttachments, t]
	);

	const onAttach: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
		const list = ev.target.files;
		ev.target.value = '';
		if (!list?.length) {
			return;
		}
		await attachMultipleFiles(Array.from(list));
	};

	const onDropFiles: React.DragEventHandler<HTMLDivElement> = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const list = e.dataTransfer.files;
		if (list?.length) {
			void attachMultipleFiles(Array.from(list));
		}
	};

	const onDragOverFiles: React.DragEventHandler<HTMLDivElement> = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	};

	const warnAttachNeedsChat = React.useCallback(
		(loadingList: boolean, chatsLength: number) => {
			if (loadingList) {
				return;
			}
			const cid = initialAttachUnifiedContentId?.trim();
			if (!cid || warnedDesktopAttachNoChatRef.current || activeId) {
				return;
			}
			if (chatsLength > 0) {
				return;
			}
			warnedDesktopAttachNoChatRef.current = true;
			toast.info(t('attachNeedsCreateChatHint'));
		},
		[activeId, initialAttachUnifiedContentId, t]
	);

	return {
		attachments,
		setAttachments,
		attachRef,
		refreshAttachments,
		onAttach,
		onDropFiles,
		onDragOverFiles,
		warnAttachNeedsChat,
	};
}

export function looksLikeUrlLabel(s: string | null): boolean {
	if (!s) {
		return false;
	}
	return /^https?:\/\//i.test(s.trim());
}
