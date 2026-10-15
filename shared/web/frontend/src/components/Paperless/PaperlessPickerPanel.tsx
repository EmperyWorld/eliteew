/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared modal panel to browse Paperless-ngx documents and import into an editor contour.
 *
 * Invariants:
 * - Import target is chosen by parent via `onImport` callback (elite vs v2).
 * - Does not store Paperless credentials in the browser.
 *
 * Related:
 * - src/services/paperlessApi.ts
 */

import { DESKTOP_OVERLAY, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import {
	ArrowPathIcon,
	DocumentTextIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	fetchPaperlessHealth,
	listPaperlessDocuments,
	type PaperlessDocumentItem,
} from '@/services/paperlessApi';

export type PaperlessPickerPanelProps = {
	isOpen: boolean;
	onClose: () => void;
	onImport: (item: PaperlessDocumentItem) => Promise<void>;
	title?: string;
};

export function PaperlessPickerPanel({
	isOpen,
	onClose,
	onImport,
	title,
}: PaperlessPickerPanelProps) {
	const { t } = useTranslation('documentEditor');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [query, setQuery] = useState('');
	const [items, setItems] = useState<PaperlessDocumentItem[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [importingId, setImportingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [available, setAvailable] = useState<boolean | null>(null);

	const load = useCallback(
		async (nextPage = 1, search = query) => {
			setLoading(true);
			setError(null);
			try {
				const health = await fetchPaperlessHealth();
				setAvailable(health.configured && health.reachable);
				if (!health.configured || !health.reachable) {
					setItems([]);
					setTotal(0);
					return;
				}
				const response = await listPaperlessDocuments({
					query: search,
					page: nextPage,
					pageSize: 25,
				});
				setItems(response.items);
				setTotal(response.total);
				setPage(response.page);
			} catch (err: unknown) {
				setError(
					err instanceof Error
						? err.message
						: t('paperless.loadFailed', 'Failed to load Paperless')
				);
				setAvailable(false);
			} finally {
				setLoading(false);
			}
		},
		[query, t]
	);

	useEffect(() => {
		if (!isOpen) return;
		void load(1, query);
	}, [isOpen, load, query]);

	if (!isOpen) return null;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className={cn(
				'fixed inset-0 flex items-center justify-center',
				DESKTOP_OVERLAY.backdrop
			)}
			style={{ zIndex: embeddedModalZ.backdrop }}
			onClick={onClose}
		>
			<motion.div
				className={cn(
					DESKTOP_OVERLAY.panelSurface,
					'flex max-h-[min(80vh,720px)] w-[min(92vw,640px)] flex-col gap-3 p-4'
				)}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(event) => event.stopPropagation()}
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<DocumentTextIcon
							className="h-5 w-5 text-emerald-400"
							aria-hidden
						/>
						<h2 className={DESKTOP_TYPOGRAPHY.title}>
							{title ?? t('paperless.title', 'Paperless archive')}
						</h2>
					</div>
					<button
						type="button"
						className="rounded-(--desktop-radius) p-1.5 text-(--desktop-text-muted) transition-colors hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)"
						onClick={onClose}
						aria-label={t('paperless.close', 'Close')}
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>

				<div className="flex gap-2">
					<input
						className={cn(
							'flex-1 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary) outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
						)}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t('paperless.searchPlaceholder', 'Search documents…')}
						onKeyDown={(event) => {
							if (event.key === 'Enter') void load(1, query);
						}}
					/>
					<DesktopAppButton
						variant="neutral"
						onClick={() => void load(1, query)}
						disabled={loading}
					>
						{t('paperless.search', 'Search')}
					</DesktopAppButton>
					<DesktopAppButton
						variant="ghost"
						onClick={() => void load(page, query)}
						disabled={loading}
					>
						<ArrowPathIcon
							className={cn('h-4 w-4', loading && 'animate-spin')}
						/>
					</DesktopAppButton>
				</div>

				{available === false ? (
					<p className="text-sm text-amber-300">
						{t(
							'paperless.unavailable',
							'Paperless is not configured or unreachable. Set PAPERLESS_API_TOKEN on the API server.'
						)}
					</p>
				) : null}
				{error ? <p className="text-sm text-red-300">{error}</p> : null}

				<div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10">
					{items.length === 0 && !loading ? (
						<p className="p-4 text-sm text-white/60">
							{t('paperless.empty', 'No documents found.')}
						</p>
					) : (
						<ul className="divide-y divide-white/10">
							{items.map((item) => (
								<li
									key={item.id}
									className="flex items-center justify-between gap-3 p-3"
								>
									<div className="min-w-0">
										<p className="truncate font-medium text-white">
											{item.title}
										</p>
										<p className="truncate text-xs text-white/50">
											#{item.id}
											{item.file_type ? ` · ${item.file_type}` : ''}
											{item.original_file_name
												? ` · ${item.original_file_name}`
												: ''}
										</p>
									</div>
									<DesktopAppButton
										variant="accent"
										disabled={importingId === item.id}
										onClick={() => {
											setImportingId(item.id);
											void onImport(item)
												.then(() => onClose())
												.catch((err: unknown) => {
													setError(
														err instanceof Error
															? err.message
															: t('paperless.importFailed', 'Import failed')
													);
												})
												.finally(() => setImportingId(null));
										}}
									>
										{importingId === item.id
											? t('paperless.importing', 'Importing…')
											: t('paperless.import', 'Import')}
									</DesktopAppButton>
								</li>
							))}
						</ul>
					)}
				</div>

				{total > items.length ? (
					<p className="text-xs text-white/50">
						{t('paperless.pageHint', 'Showing {{count}} of {{total}}', {
							count: items.length,
							total,
						})}
					</p>
				) : null}
			</motion.div>
		</motion.div>
	);
}
