/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Paginated account activity history for Social Hub / profile «Активность».
 *
 * Invariants:
 * - Module filename must not be `ActivityLog.tsx`: public edge returns 404 for
 *   `/assets/ActivityLog-*.js` while prod-core `:29001` serves 200 (WAF/path filter).
 * - Lazy chunk name follows this file (`ProfileActivityPanel-*.js`).
 *
 * Related:
 * - ProfileAccountMorePanel.tsx
 * - documentation/platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
	ActivityLogEntry,
	ActivityLogResponse,
} from '../../types/profile';
import { formatRelativeTime } from '../../types/profile';
import profileService from '../../services/profileService';
import { log } from '../../utils/logger';
import { cn } from '@/utils/cn';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ArrowPathIcon,
	ArrowRightEndOnRectangleIcon,
	ArrowRightStartOnRectangleIcon,
	ArrowUpTrayIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CodeBracketIcon,
	Cog6ToothIcon,
	ComputerDesktopIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	EyeIcon,
	LockClosedIcon,
	MapPinIcon,
	PencilSquareIcon,
	ShieldCheckIcon,
	SignalIcon,
	TrashIcon,
	UserIcon,
} from '@heroicons/react/24/outline';

export default function ProfileActivityPanel({
	embedded = false,
	refreshKey = 0,
}: {
	embedded?: boolean;
	/** Increment when profile/avatar changes so the list refetches without remounting the tab. */
	refreshKey?: number;
} = {}): JSX.Element {
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalItems, setTotalItems] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedMetadata, setExpandedMetadata] = useState<string | null>(null);

	const perPage = 50;

	const loadActivities = useCallback(async (page: number): Promise<void> => {
		setIsLoading(true);
		setError(null);

		try {
			const response: ActivityLogResponse = await profileService.getActivityLog(
				page,
				perPage
			);

			setActivities(response.activities);
			setTotalPages(response.total_pages);
			setTotalItems(response.total);
			setCurrentPage(response.page);
		} catch (err: unknown) {
			log.error(
				'ProfileActivityPanel',
				'Failed to load activity log',
				err instanceof Error ? err : undefined,
				err
			);
			const errorMessage =
				err &&
				typeof err === 'object' &&
				'response' in err &&
				err.response &&
				typeof err.response === 'object' &&
				'data' in err.response &&
				err.response.data &&
				typeof err.response.data === 'object' &&
				'message' in err.response.data &&
				typeof err.response.data.message === 'string'
					? err.response.data.message
					: 'Не удалось загрузить историю активности';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load activities (refreshKey bumps when profile/avatar changes — parent-driven invalidation)
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentionally retriggers fetch when parent increments it
	useEffect(() => {
		void loadActivities(currentPage);
	}, [currentPage, loadActivities, refreshKey]);

	const handlePageChange = (newPage: number): void => {
		if (newPage < 1 || newPage > totalPages) {
			return;
		}
		setCurrentPage(newPage);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const iconCls = `${DESKTOP_LUCIDE.lg}`;

	const getActionIcon = (action: string): React.ReactNode => {
		const sw = DESKTOP_LUCIDE.stroke;
		const iconMap: Record<string, React.ReactNode> = {
			login: (
				<ArrowRightEndOnRectangleIcon
					className={iconCls}
					strokeWidth={sw}
					aria-hidden
				/>
			),
			logout: (
				<ArrowRightStartOnRectangleIcon
					className={iconCls}
					strokeWidth={sw}
					aria-hidden
				/>
			),
			password_changed: (
				<LockClosedIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			profile_updated: (
				<UserIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			preferences_updated: (
				<Cog6ToothIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			avatar_uploaded: (
				<ArrowUpTrayIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			avatar_deleted: (
				<TrashIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			content_created: (
				<DocumentTextIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			content_updated: (
				<PencilSquareIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			content_deleted: (
				<TrashIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			content_viewed: (
				<EyeIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			session_revoked: (
				<ShieldCheckIcon className={iconCls} strokeWidth={sw} aria-hidden />
			),
			security_alert: (
				<ExclamationCircleIcon
					className={iconCls}
					strokeWidth={sw}
					aria-hidden
				/>
			),
		};

		return (
			iconMap[action] || (
				<SignalIcon className={iconCls} strokeWidth={sw} aria-hidden />
			)
		);
	};

	const getActionColor = (action: string): string => {
		if (action.includes('login') || action.includes('created')) {
			return 'text-emerald-400/75';
		}
		if (action.includes('logout') || action.includes('deleted')) {
			return 'text-rose-400/75';
		}
		if (action.includes('password') || action.includes('security')) {
			return 'text-amber-400/75';
		}
		if (action.includes('updated')) {
			return 'text-(--desktop-text-secondary)';
		}
		return 'text-(--desktop-text-dim)';
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="rounded-xl"
			>
				<DesktopAppPanel
					className={cn(shellPanel, 'flex items-center justify-between p-6')}
				>
					<div className="flex items-center gap-3">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
							<SignalIcon
								className={DESKTOP_LUCIDE.lg}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</span>
						<div>
							<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
								История активности
							</h2>
							<p className="text-sm text-(--desktop-text-muted) antialiased">
								Всего записей: {totalItems.toLocaleString()}
								{totalItems === 0 && (
									<span className="mt-1 block text-xs text-(--desktop-text-dim)">
										Записи создаются при смене пароля, аватара или отзыве сессий
									</span>
								)}
							</p>
						</div>
					</div>

					{/* Page info */}
					{totalPages > 1 && (
						<DesktopAppStatusBadge className="text-xs">
							Страница {currentPage} из {totalPages}
						</DesktopAppStatusBadge>
					)}
				</DesktopAppPanel>
			</motion.div>

			{/* Error */}
			{error && (
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex items-center gap-3 rounded-xl border border-rose-500/35 bg-rose-500/[0.07] p-4"
				>
					<ExclamationCircleIcon
						className="h-5 w-5 shrink-0 text-rose-400/90"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					<p className="flex-1 text-sm text-rose-200/90">{error}</p>
				</motion.div>
			)}

			{/* Loading */}
			{isLoading ? (
				<div className="flex items-center justify-center py-20">
					<ArrowPathIcon
						className="h-8 w-8 shrink-0 animate-spin text-(--desktop-text-muted)"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</div>
			) : activities.length === 0 ? (
				// Empty state
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="rounded-xl"
				>
					<DesktopAppPanel className={cn(shellPanel, 'p-12')}>
						<DesktopAppEmptyState
							icon={
								<SignalIcon
									className="h-16 w-16 text-(--desktop-text-dim)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title="Нет записей"
							description="Записи появляются при действиях в профиле: смена пароля, загрузка или удаление аватара, отзыв сессий входа."
						>
							<p className="text-sm text-(--desktop-text-muted) antialiased">
								История активности пуста
							</p>
						</DesktopAppEmptyState>
					</DesktopAppPanel>
				</motion.div>
			) : (
				<>
					{/* SignalIcon list */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="rounded-xl"
					>
						<DesktopAppPanel className={cn(shellPanel, 'overflow-hidden')}>
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
										<tr>
											<th className="px-6 py-4 text-left text-sm font-medium text-(--desktop-text-secondary)">
												Действие
											</th>
											<th className="px-6 py-4 text-left text-sm font-medium text-(--desktop-text-secondary)">
												Описание
											</th>
											<th className="px-6 py-4 text-left text-sm font-medium text-(--desktop-text-secondary)">
												IP адрес
											</th>
											<th className="px-6 py-4 text-left text-sm font-medium text-(--desktop-text-secondary)">
												Время
											</th>
											<th className="px-6 py-4 text-left text-sm font-medium text-(--desktop-text-secondary)">
												Детали
											</th>
										</tr>
									</thead>
									<tbody>
										{activities.map((activity, index) => (
											<React.Fragment key={activity.id}>
												<motion.tr
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ delay: index * 0.02 }}
													className="border-b border-(--desktop-border-subtle) transition-colors hover:bg-(--desktop-surface-soft)"
												>
													{/* Action */}
													<td className="px-6 py-4">
														<div className="flex items-center gap-3">
															<div className={getActionColor(activity.action)}>
																{getActionIcon(activity.action)}
															</div>
															<span className="font-medium text-(--desktop-text-primary)">
																{activity.action}
															</span>
														</div>
													</td>

													{/* Description */}
													<td className="px-6 py-4">
														<span className="text-(--desktop-text-secondary)">
															{activity.description || '-'}
														</span>
													</td>

													{/* IP Address */}
													<td className="px-6 py-4">
														{activity.ip_address ? (
															<div className="flex items-center gap-2 text-(--desktop-text-muted)">
																<MapPinIcon
																	className={DESKTOP_LUCIDE.md}
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																	aria-hidden
																/>
																<span className="font-mono text-sm">
																	{activity.ip_address}
																</span>
															</div>
														) : (
															<span className="text-(--desktop-text-dim)">
																-
															</span>
														)}
													</td>

													{/* Time */}
													<td className="px-6 py-4">
														<span className="text-sm text-(--desktop-text-muted) antialiased">
															{formatRelativeTime(activity.created_at)}
														</span>
													</td>

													{/* Metadata toggle */}
													<td className="px-6 py-4">
														{activity.metadata &&
														Object.keys(activity.metadata).length > 0 ? (
															<DesktopAppButton
																type="button"
																onClick={() =>
																	setExpandedMetadata(
																		expandedMetadata === activity.id
																			? null
																			: activity.id
																	)
																}
																variant="neutral"
																size="sm"
																className="gap-2 text-sm"
															>
																<CodeBracketIcon
																	className={DESKTOP_LUCIDE.md}
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																	aria-hidden
																/>
																{expandedMetadata === activity.id
																	? 'Скрыть'
																	: 'Показать'}
															</DesktopAppButton>
														) : (
															<span className="text-sm text-(--desktop-text-dim)">
																-
															</span>
														)}
													</td>
												</motion.tr>

												{/* Expanded metadata row */}
												<AnimatePresence>
													{expandedMetadata === activity.id && (
														<motion.tr
															initial={{ opacity: 0 }}
															animate={{ opacity: 1 }}
															exit={{ opacity: 0 }}
															className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
														>
															<td colSpan={5} className="px-6 py-4">
																<div className="flex items-start gap-3">
																	<CodeBracketIcon
																		className={`mt-1 shrink-0 ${DESKTOP_LUCIDE.lg} text-(--desktop-text-dim)`}
																		strokeWidth={DESKTOP_LUCIDE.stroke}
																		aria-hidden
																	/>
																	<div className="flex-1">
																		<DesktopAppSectionLabel className="mb-2 block normal-case tracking-normal">
																			Метаданные
																		</DesktopAppSectionLabel>
																		<pre className="overflow-x-auto rounded-lg border border-(--desktop-border-subtle) bg-black/25 p-4 font-mono text-sm text-(--desktop-text-secondary)">
																			{JSON.stringify(
																				activity.metadata,
																				null,
																				2
																			)}
																		</pre>

																		{/* UserIcon Agent if available */}
																		{activity.user_agent && (
																			<div className="mt-4">
																				<div className="mb-2 flex items-center gap-2 text-(--desktop-text-muted)">
																					<ComputerDesktopIcon
																						className={DESKTOP_LUCIDE.md}
																						strokeWidth={DESKTOP_LUCIDE.stroke}
																						aria-hidden
																					/>
																					<span className="text-sm font-medium">
																						UserIcon Agent:
																					</span>
																				</div>
																				<p
																					className={cn(
																						DESKTOP_TYPOGRAPHY.meta,
																						'rounded-lg border border-(--desktop-border-subtle) bg-black/25 p-3 font-mono'
																					)}
																				>
																					{activity.user_agent}
																				</p>
																			</div>
																		)}
																	</div>
																</div>
															</td>
														</motion.tr>
													)}
												</AnimatePresence>
											</React.Fragment>
										))}
									</tbody>
								</table>
							</div>
						</DesktopAppPanel>
					</motion.div>

					{/* Pagination */}
					{totalPages > 1 && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="rounded-xl"
						>
							<DesktopAppPanel
								className={cn(
									shellPanel,
									'flex items-center justify-between p-4'
								)}
							>
								<DesktopAppButton
									type="button"
									onClick={() => handlePageChange(currentPage - 1)}
									disabled={currentPage === 1}
									variant="neutral"
									className="gap-2"
								>
									<ChevronLeftIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									Предыдущая
								</DesktopAppButton>

								{/* Page numbers */}
								<div className="flex items-center gap-2">
									{Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
										let pageNum: number;

										if (totalPages <= 7) {
											pageNum = i + 1;
										} else if (currentPage <= 4) {
											pageNum = i + 1;
										} else if (currentPage >= totalPages - 3) {
											pageNum = totalPages - 6 + i;
										} else {
											pageNum = currentPage - 3 + i;
										}

										return (
											<DesktopAppButton
												type="button"
												key={pageNum}
												onClick={() => handlePageChange(pageNum)}
												variant={currentPage === pageNum ? 'accent' : 'neutral'}
												size="icon"
												className="h-10 w-10"
											>
												{pageNum}
											</DesktopAppButton>
										);
									})}
								</div>

								<DesktopAppButton
									type="button"
									onClick={() => handlePageChange(currentPage + 1)}
									disabled={currentPage === totalPages}
									variant="neutral"
									className="gap-2"
								>
									Следующая
									<ChevronRightIcon
										className={DESKTOP_LUCIDE.lg}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								</DesktopAppButton>
							</DesktopAppPanel>
						</motion.div>
					)}
				</>
			)}
		</div>
	);
}
