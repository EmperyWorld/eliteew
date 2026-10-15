/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing manager for personal Desktop AI Chat Memory Cells (list/rename/delete).
 *
 * Invariants:
 * - Owner-scoped API only; no admin endpoints.
 *
 * Related:
 * - features/desktop-ai-chat/api/desktopChatClient.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { RetryBlock } from '@/components/ui/RetryBlock';
import {
	deleteDesktopAiMemoryCell,
	listDesktopAiMemoryCells,
	patchDesktopAiMemoryCell,
	type DesktopAiMemoryCell,
} from '@/features/desktop-ai-chat/api/desktopChatClient';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import { log } from '@/utils/logger';

export default function ProfileMemoryCellsPanel({
	embedded = false,
}: {
	embedded?: boolean;
}): JSX.Element {
	const { t } = useTranslation('desktopAiChat');
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const [cells, setCells] = useState<DesktopAiMemoryCell[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState('');
	const [editDescription, setEditDescription] = useState('');
	const [saveBusy, setSaveBusy] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const items = await listDesktopAiMemoryCells();
			setCells(items);
		} catch (err: unknown) {
			log.error(
				'ProfileMemoryCellsPanel',
				'Failed to load memory cells',
				err instanceof Error ? err : undefined,
				err
			);
			setError(t('memoryCellProfileLoadError'));
			setCells([]);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const beginEdit = (cell: DesktopAiMemoryCell) => {
		setEditingId(cell.id);
		setEditTitle(cell.title);
		setEditDescription(cell.description ?? '');
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditTitle('');
		setEditDescription('');
	};

	const saveEdit = async () => {
		if (!editingId) return;
		const title = editTitle.trim();
		if (!title) {
			toast.error(t('memoryCellProfileTitleRequired'));
			return;
		}
		setSaveBusy(true);
		try {
			const updated = await patchDesktopAiMemoryCell(editingId, {
				title,
				description: editDescription.trim() || null,
			});
			setCells((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
			cancelEdit();
			toast.success(t('memoryCellProfileSaved'));
		} catch (err: unknown) {
			log.error(
				'ProfileMemoryCellsPanel',
				'Failed to patch memory cell',
				err instanceof Error ? err : undefined,
				err
			);
			toast.error(t('memoryCellProfileSaveError'));
		} finally {
			setSaveBusy(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteId) return;
		setDeleteBusy(true);
		try {
			await deleteDesktopAiMemoryCell(deleteId);
			setCells((prev) => prev.filter((c) => c.id !== deleteId));
			if (editingId === deleteId) cancelEdit();
			setDeleteId(null);
			toast.success(t('memoryCellProfileDeleted'));
		} catch (err: unknown) {
			log.error(
				'ProfileMemoryCellsPanel',
				'Failed to delete memory cell',
				err instanceof Error ? err : undefined,
				err
			);
			toast.error(t('memoryCellProfileDeleteError'));
		} finally {
			setDeleteBusy(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-3" role="status" aria-busy="true">
				<DesktopAppSkeleton className="h-16 rounded-(--desktop-radius-lg)" />
				<DesktopAppSkeleton className="h-28 rounded-(--desktop-radius-lg)" />
			</div>
		);
	}

	if (error && cells.length === 0) {
		return (
			<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
				<RetryBlock
					message={error}
					onRetry={() => void load()}
					retryLabel={t('memoryCellProfileRetry')}
				/>
			</DesktopAppPanel>
		);
	}

	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) pb-3">
				<p className={cn('min-w-0', DESKTOP_TYPOGRAPHY.bodyMuted)}>
					{t('memoryCellProfileHint', { max: 3 })}
				</p>
				<DesktopAppButton
					type="button"
					onClick={() => void load()}
					variant="accent"
					size="sm"
					className="shrink-0 gap-2"
				>
					<ArrowPathIcon
						className={DESKTOP_LUCIDE.md}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('memoryCellProfileRefresh')}
				</DesktopAppButton>
			</div>

			{cells.length === 0 ? (
				<DesktopAppEmptyState
					title={t('memoryCellProfileEmptyTitle')}
					description={t('memoryCellProfileEmptyBody')}
				/>
			) : (
				<ul className="space-y-3">
					{cells.map((cell) => {
						const editing = editingId === cell.id;
						return (
							<li key={cell.id}>
								<DesktopAppPanel className={cn(shellPanel, 'p-4')}>
									{editing ? (
										<div className="space-y-3">
											<label className="block space-y-1">
												<span className={DESKTOP_TYPOGRAPHY.caption}>
													{t('memoryCellProfileTitle')}
												</span>
												<input
													value={editTitle}
													onChange={(e) => setEditTitle(e.target.value)}
													disabled={saveBusy}
													className="w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-bg-elevated) px-3 py-2 text-sm"
												/>
											</label>
											<label className="block space-y-1">
												<span className={DESKTOP_TYPOGRAPHY.caption}>
													{t('memoryCellProfileDescription')}
												</span>
												<textarea
													value={editDescription}
													onChange={(e) => setEditDescription(e.target.value)}
													disabled={saveBusy}
													rows={3}
													className="w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-bg-elevated) px-3 py-2 text-sm"
												/>
											</label>
											<div className="flex flex-wrap gap-2">
												<DesktopAppButton
													type="button"
													size="sm"
													variant="accent"
													disabled={saveBusy}
													onClick={() => void saveEdit()}
												>
													{t('memoryCellProfileSave')}
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													disabled={saveBusy}
													onClick={cancelEdit}
												>
													{t('memoryCellProfileCancel')}
												</DesktopAppButton>
											</div>
										</div>
									) : (
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="min-w-0 flex-1 space-y-1">
												<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
													{cell.title}
												</p>
												{cell.description ? (
													<p
														className={cn(
															'line-clamp-2',
															DESKTOP_TYPOGRAPHY.bodyMuted
														)}
													>
														{cell.description}
													</p>
												) : null}
												<p className={DESKTOP_TYPOGRAPHY.micro}>
													{t('memoryCellProfileMeta', {
														status: cell.status,
														chunks: cell.chunk_count,
														messages: cell.message_count_indexed,
													})}
												</p>
											</div>
											<div className="flex shrink-0 gap-1">
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													aria-label={t('memoryCellProfileEditAria')}
													onClick={() => beginEdit(cell)}
													className="gap-1"
												>
													<PencilSquareIcon
														className={DESKTOP_LUCIDE.md}
														strokeWidth={DESKTOP_LUCIDE.stroke}
														aria-hidden
													/>
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													aria-label={t('memoryCellProfileDeleteAria')}
													onClick={() => setDeleteId(cell.id)}
													className="gap-1"
												>
													<TrashIcon
														className={DESKTOP_LUCIDE.md}
														strokeWidth={DESKTOP_LUCIDE.stroke}
														aria-hidden
													/>
												</DesktopAppButton>
											</div>
										</div>
									)}
								</DesktopAppPanel>
							</li>
						);
					})}
				</ul>
			)}

			<ConfirmDeleteModal
				isOpen={deleteId != null}
				onClose={() => {
					if (!deleteBusy) setDeleteId(null);
				}}
				onConfirm={() => confirmDelete()}
				title={t('memoryCellProfileDeleteTitle')}
				warningMessage={t('memoryCellProfileDeleteBody')}
				confirmButtonLabel={t('memoryCellProfileDeleteConfirm')}
				closeAfterConfirm={false}
			/>
		</div>
	);
}
