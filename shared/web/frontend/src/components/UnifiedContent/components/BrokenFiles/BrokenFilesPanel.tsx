/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Manager «Broken files» tab — owner list, recheck, permanent delete.
 *
 * Invariants:
 * - Relies on API quarantine filter for folders; no FE business-rule duplicate.
 * - Permanent delete requires ConfirmDeleteModal confirm.
 * - Recheck HTTP 200 with ok:false must surface honest UI feedback (not silent stay).
 *
 * Related:
 * - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
 * - DuplicateFinder (peer UX pattern)
 */
import {
	ArrowPathIcon,
	ExclamationTriangleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../../../pages/Desktop/utils/desktopVisualSystem';
import {
	contentApi,
	type BrokenContentItem,
	type BrokenContentListResponse,
	toContentError,
} from '../../../../services/contentApi';
import { log } from '../../../../utils/logger';
import { formatBytes, formatDateShort } from '../../utils/contentUtils';

export type BrokenFilesPanelProps = {
	onChange?: () => void | Promise<void>;
};

type RecheckFeedback =
	| { kind: 'ok'; name: string }
	| { kind: 'still_broken'; name: string }
	| null;

function reasonLabel(
	t: (key: string) => string,
	reason: string | null | undefined
): string {
	const code = (reason || '').trim();
	if (!code) return t('brokenFiles.reasonUnknown');
	const key = `brokenFiles.reasons.${code}`;
	const translated = t(key);
	return translated === key ? t('brokenFiles.reasonGeneric') : translated;
}

function itemDisplayName(item: BrokenContentItem): string {
	return (
		(item.title || item.name || item.original_filename || item.id).trim() ||
		item.id
	);
}

export function BrokenFilesPanel({ onChange }: BrokenFilesPanelProps) {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [recheckFeedback, setRecheckFeedback] = useState<RecheckFeedback>(null);
	const [data, setData] = useState<BrokenContentListResponse | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<BrokenContentItem | null>(
		null
	);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const next = await contentApi.listBrokenContent();
			setData(next);
		} catch (err) {
			const message = toContentError(err, t('brokenFiles.loadError'));
			log.error(
				'BrokenFilesPanel',
				'load failed',
				err instanceof Error ? err : undefined
			);
			setError(message);
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRecheck = useCallback(
		async (item: BrokenContentItem) => {
			const displayName = itemDisplayName(item);
			setBusyId(item.id);
			setError(null);
			setRecheckFeedback(null);
			try {
				const result = await contentApi.storageRecheck(item.id);
				if (result.ok) {
					setData((prev) =>
						prev
							? {
									...prev,
									total: Math.max(0, prev.total - 1),
									items: prev.items.filter((row) => row.id !== item.id),
								}
							: prev
					);
					setRecheckFeedback({ kind: 'ok', name: displayName });
					await onChange?.();
				} else {
					await load();
					setRecheckFeedback({ kind: 'still_broken', name: displayName });
				}
			} catch (err) {
				setRecheckFeedback(null);
				setError(toContentError(err, t('brokenFiles.recheckError')));
				log.error(
					'BrokenFilesPanel',
					'recheck failed',
					err instanceof Error ? err : undefined
				);
			} finally {
				setBusyId(null);
			}
		},
		[load, onChange, t]
	);

	const executePermanentDelete = useCallback(async () => {
		if (!pendingDelete) return;
		try {
			await contentApi.permanentDeleteContent(pendingDelete.id);
			setData((prev) =>
				prev
					? {
							...prev,
							total: Math.max(0, prev.total - 1),
							items: prev.items.filter((row) => row.id !== pendingDelete.id),
						}
					: prev
			);
			setPendingDelete(null);
			await onChange?.();
		} catch (err) {
			log.error(
				'BrokenFilesPanel',
				'permanent delete failed',
				err instanceof Error ? err : undefined
			);
			throw new Error(toContentError(err, t('brokenFiles.deleteError')));
		}
	}, [onChange, pendingDelete, t]);

	if (loading && !data) {
		return (
			<div className={cn('space-y-3 p-4', shellContentPanelClass)}>
				<DesktopAppSkeleton className="h-10 w-48" />
				<DesktopAppSkeleton className="h-24" />
				<DesktopAppSkeleton className="h-24" />
			</div>
		);
	}

	if (error && !data) {
		return (
			<div className={cn('p-4', shellContentPanelClass)}>
				<DesktopAppErrorState message={error} />
				<div className="mt-3">
					<DesktopAppButton type="button" onClick={() => void load()}>
						{t('brokenFiles.retry')}
					</DesktopAppButton>
				</div>
			</div>
		);
	}

	const items = data?.items ?? [];

	return (
		<div className={cn('space-y-4 p-4', shellContentPanelClass)}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h2
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'flex items-center gap-2'
						)}
					>
						<ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden />
						{t('brokenFiles.title')}
					</h2>
					<p
						className={cn(DESKTOP_TYPOGRAPHY.caption, 'max-w-prose opacity-80')}
					>
						{t('brokenFiles.subtitle')}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="neutral"
					className={DESKTOP_CHROME_FOCUS_VISIBLE}
					onClick={() => {
						setRecheckFeedback(null);
						void load();
					}}
					disabled={loading}
				>
					<ArrowPathIcon className="h-4 w-4" aria-hidden />
					{t('brokenFiles.refresh')}
				</DesktopAppButton>
			</div>

			{error ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-red-600')}
					role="alert"
				>
					{error}
				</p>
			) : null}

			{recheckFeedback?.kind === 'ok' ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-emerald-700')}
					role="status"
				>
					{t('brokenFiles.recheckOk', { name: recheckFeedback.name })}
				</p>
			) : null}

			{recheckFeedback?.kind === 'still_broken' ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-amber-800')}
					role="status"
				>
					{t('brokenFiles.recheckStillBroken', {
						name: recheckFeedback.name,
					})}
				</p>
			) : null}

			{items.length === 0 ? (
				<DesktopAppEmptyState
					title={t('brokenFiles.emptyTitle')}
					description={t('brokenFiles.emptyDescription')}
					className="mx-auto max-w-md"
				/>
			) : (
				<ul className="space-y-3">
					{items.map((item) => {
						const displayName = itemDisplayName(item);
						const busy = busyId === item.id;
						return (
							<li
								key={item.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--desktop-border-subtle) px-3 py-3"
							>
								<div className="min-w-0 space-y-1">
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.body,
											'font-medium truncate'
										)}
									>
										{displayName}
									</p>
									<div className="flex flex-wrap items-center gap-2">
										<DesktopAppStatusBadge>
											{reasonLabel(t, item.storage_broken_reason)}
										</DesktopAppStatusBadge>
										{typeof item.file_size === 'number' ? (
											<span className={DESKTOP_TYPOGRAPHY.caption}>
												{formatBytes(item.file_size)}
											</span>
										) : null}
										{item.storage_broken_at ? (
											<span className={DESKTOP_TYPOGRAPHY.caption}>
												{formatDateShort(item.storage_broken_at, i18n.language)}
											</span>
										) : null}
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										disabled={busy}
										onClick={() => void handleRecheck(item)}
									>
										<ArrowPathIcon className="h-4 w-4" aria-hidden />
										{t('brokenFiles.recheck')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="danger"
										size="sm"
										disabled={busy}
										onClick={() => setPendingDelete(item)}
									>
										<TrashIcon className="h-4 w-4" aria-hidden />
										{t('brokenFiles.permanentDelete')}
									</DesktopAppButton>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<ConfirmDeleteModal
				isOpen={pendingDelete !== null}
				onClose={() => setPendingDelete(null)}
				onConfirm={executePermanentDelete}
				title={t('brokenFiles.confirmTitle')}
				itemName={
					pendingDelete?.title ||
					pendingDelete?.name ||
					pendingDelete?.original_filename ||
					undefined
				}
				warningMessage={t('brokenFiles.confirmBody')}
				cancelButtonLabel={t('brokenFiles.modalCancel')}
				confirmButtonLabel={t('brokenFiles.modalConfirm')}
				confirmButtonLoadingLabel={t('brokenFiles.modalDeleting')}
				variant="desktop"
			/>
		</div>
	);
}

export default BrokenFilesPanel;
