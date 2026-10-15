/**
 * View history — backed by DB (content_user_file_views), not localStorage.
 */
import { motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
	ArrowTrendingUpIcon,
	ClockIcon,
	EyeIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import type { ContentViewHistoryApiItem } from '../../../../services/contentApi';
import type { Content } from '../../types';
import { DesktopAppSkeleton } from '../../../../pages/Desktop/components/DesktopAppChrome';

export interface ViewHistoryProps {
	entries: ContentViewHistoryApiItem[];
	loading?: boolean;
	onSelect: (content: Content) => void;
	onClear: () => void | Promise<void>;
	maxItems?: number;
}

export const ViewHistory: React.FC<ViewHistoryProps> = ({
	entries,
	loading = false,
	onSelect,
	onClear,
	maxItems = 10,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const [showClearModal, setShowClearModal] = useState(false);
	const [, setRelativeTick] = useState(0);

	const relativeTimeFormatter = useMemo(
		() => new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' }),
		[i18n.language]
	);

	const absoluteDateTimeFormatter = useMemo(
		() =>
			new Intl.DateTimeFormat(i18n.language, {
				dateStyle: 'medium',
				timeStyle: 'short',
			}),
		[i18n.language]
	);

	useEffect(() => {
		const id = window.setInterval(() => {
			setRelativeTick((n) => n + 1);
		}, 60_000);
		return () => window.clearInterval(id);
	}, []);

	const formatLastViewedRelative = (dateString: string): string => {
		const date = new Date(dateString);
		const t0 = date.getTime();
		if (!Number.isFinite(t0)) {
			return '';
		}
		const diffMs = t0 - Date.now();

		const diffSec = Math.round(diffMs / 1000);
		if (Math.abs(diffSec) < 60) {
			return relativeTimeFormatter.format(diffSec, 'second');
		}

		const diffMin = Math.round(diffMs / (1000 * 60));
		if (Math.abs(diffMin) < 60) {
			return relativeTimeFormatter.format(diffMin, 'minute');
		}

		const diffHr = Math.round(diffMs / (1000 * 60 * 60));
		if (Math.abs(diffHr) < 24) {
			return relativeTimeFormatter.format(diffHr, 'hour');
		}

		const diffDay = Math.round(diffMs / (1000 * 60 * 60 * 24));
		if (Math.abs(diffDay) < 7) {
			return relativeTimeFormatter.format(diffDay, 'day');
		}

		if (Math.abs(diffDay) < 30) {
			return relativeTimeFormatter.format(Math.round(diffDay / 7), 'week');
		}

		if (Math.abs(diffDay) < 365) {
			return relativeTimeFormatter.format(Math.round(diffDay / 30), 'month');
		}

		return relativeTimeFormatter.format(Math.round(diffDay / 365), 'year');
	};

	const recentlyViewed = useMemo(() => {
		return [...entries]
			.sort((a, b) => {
				const ta = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : 0;
				const tb = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : 0;
				return tb - ta;
			})
			.slice(0, Math.min(maxItems, 5));
	}, [entries, maxItems]);

	const frequentlyUsed = useMemo(() => {
		return [...entries]
			.sort((a, b) => b.view_count - a.view_count)
			.slice(0, Math.min(maxItems, 5));
	}, [entries, maxItems]);

	if (loading) {
		return (
			<div className="space-y-3 py-2" role="status" aria-busy="true">
				<DesktopAppSkeleton className="h-8 w-48" />
				<DesktopAppSkeleton className="h-24" />
				<DesktopAppSkeleton className="h-24" />
			</div>
		);
	}

	if (entries.length === 0) {
		return (
			<div className="py-8 text-center text-(--desktop-text-muted)">
				<ClockIcon className="mx-auto mb-3 h-12 w-12 text-(--desktop-text-dim) opacity-50" />
				<p>{t('viewHistory.emptyTitle')}</p>
				<p className="mt-1 text-sm text-(--desktop-text-secondary)">
					{t('viewHistory.emptyDesc')}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<ClockIcon className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]" />
					<h3 className="truncate text-base font-semibold text-(--desktop-text-primary)">
						{t('viewHistory.title')}
					</h3>
				</div>
				<button
					type="button"
					onClick={() => setShowClearModal(true)}
					aria-label={t('viewHistory.clearAria')}
					className="shrink-0 rounded-md px-2.5 py-1 text-xs text-(--desktop-text-muted) transition-colors duration-200 motion-reduce:transition-none hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/55"
				>
					{t('viewHistory.clear')}
				</button>
			</div>

			{recentlyViewed.length > 0 && (
				<div>
					<div className="mb-1.5 flex items-center gap-1.5">
						<ClockIcon className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)" />
						<h4 className="text-xs font-medium text-(--desktop-text-secondary)">
							{t('viewHistory.recent')}
						</h4>
					</div>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{recentlyViewed.map((row) => {
							const content = row.content;
							const lastIso = row.last_viewed_at;
							const absoluteTitle =
								lastIso && Number.isFinite(new Date(lastIso).getTime())
									? absoluteDateTimeFormatter.format(new Date(lastIso))
									: undefined;
							return (
								<motion.button
									type="button"
									key={content.id}
									onClick={() => onSelect(content)}
									whileTap={{ scale: 0.985 }}
									title={
										absoluteTitle
											? `${content.name} — ${absoluteTitle}`
											: content.name
									}
									className="rounded-lg border border-(--desktop-border-subtle)/50 bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.14)_100%,transparent)] p-2 text-left transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] hover:shadow-(--desktop-shadow-soft)"
								>
									<div className="flex items-start gap-2">
										<div className="rounded-md bg-[rgb(var(--desktop-accent-rgb)/0.14)] p-1.5">
											<EyeIcon className="h-3.5 w-3.5 text-[rgb(var(--desktop-accent-rgb)/0.9)]" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
												{content.name}
											</div>
											{lastIso ? (
												<time
													className="mt-0.5 block text-[11px] leading-tight text-(--desktop-text-muted)"
													dateTime={lastIso}
													title={absoluteTitle}
												>
													{formatLastViewedRelative(lastIso)}
												</time>
											) : null}
										</div>
									</div>
								</motion.button>
							);
						})}
					</div>
				</div>
			)}

			{frequentlyUsed.length > 0 && (
				<div>
					<div className="mb-1.5 flex items-center gap-1.5">
						<ArrowTrendingUpIcon className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)" />
						<h4 className="text-xs font-medium text-(--desktop-text-secondary)">
							{t('viewHistory.frequent')}
						</h4>
					</div>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{frequentlyUsed.map((row) => {
							const content = row.content;
							const lastIso = row.last_viewed_at;
							const absoluteTitle =
								lastIso && Number.isFinite(new Date(lastIso).getTime())
									? absoluteDateTimeFormatter.format(new Date(lastIso))
									: undefined;
							const views = row.view_count;
							return (
								<motion.button
									type="button"
									key={`freq-${content.id}`}
									onClick={() => onSelect(content)}
									whileTap={{ scale: 0.985 }}
									title={
										absoluteTitle
											? `${content.name} — ${t('viewHistory.viewsLine', { n: views })} — ${absoluteTitle}`
											: `${content.name} — ${t('viewHistory.viewsLine', { n: views })}`
									}
									className="rounded-lg border border-(--desktop-border-subtle)/50 bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.14)_100%,transparent)] p-2 text-left transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] hover:shadow-(--desktop-shadow-soft)"
								>
									<div className="flex items-start gap-2">
										<div className="rounded-md bg-emerald-500/15 p-1.5">
											<ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-400/90" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
												{content.name}
											</div>
											<div className="mt-0.5 text-[11px] leading-tight text-(--desktop-text-muted)">
												{t('viewHistory.viewsLine', { n: views })}
												{lastIso ? (
													<>
														{' · '}
														<time
															dateTime={lastIso}
															title={absoluteTitle}
															className="inline"
														>
															{formatLastViewedRelative(lastIso)}
														</time>
													</>
												) : null}
											</div>
										</div>
									</div>
								</motion.button>
							);
						})}
					</div>
				</div>
			)}

			<ConfirmDeleteModal
				isOpen={showClearModal}
				onClose={() => setShowClearModal(false)}
				onConfirm={async () => {
					await Promise.resolve(onClear());
				}}
				title={t('viewHistory.clearModalTitle')}
				warningMessage={t('viewHistory.clearModalWarning')}
				cancelButtonLabel={t('viewHistory.clearModalCancel')}
				confirmButtonLabel={t('viewHistory.clearModalConfirm')}
				confirmButtonLoadingLabel={t('viewHistory.clearModalDeleting')}
			/>
		</div>
	);
};

export default ViewHistory;
