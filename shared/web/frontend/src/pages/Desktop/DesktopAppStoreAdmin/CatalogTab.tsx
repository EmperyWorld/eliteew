/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin catalog list, filters, and CRUD entrypoints (New World table tokens).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/utils/cn';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopPortaledConfirmShell,
} from '../components/DesktopAppChrome';
import { DesktopChromeTooltip } from '../components/DesktopChromeTooltip';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../context/DesktopWindowPortalStackContext';
import {
	deleteCatalogApp,
	getAccessGroups,
	getCatalog,
	updateCatalogApp,
} from '../services/desktopAdminApi';
import { notify as toast } from '@/notifications';
import { adminUiFocusRing, adminUiTableWrapClass } from '@/pages/Admin/ui';
import { AdminCatalogAppIcon } from '../components/AdminCatalogAppIcon';
import {
	ArrowPathIcon,
	CubeIcon,
	KeyIcon,
	MagnifyingGlassIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { ADMIN_QUERY_KEY } from './adminQueryKeys';
import {
	catalogGroupsSortKey,
	formatCatalogGroupsCell,
	sortableAdminColumnKeyDown,
	useDebouncedValue,
} from './adminHelpers';
import { AdminTabLoading } from './AdminTabLoading';
import { BulkGroupModal } from './BulkGroupModal';
import { CatalogEditForm } from './CatalogEditForm';
import { CatalogForm } from './CatalogForm';
import type { CatalogSortField } from './types';

export function CatalogTab(): React.ReactElement {
	const { t } = useTranslation('appStore');
	const queryClient = useQueryClient();
	const { data: catalog, isLoading } = useQuery({
		queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
		queryFn: getCatalog,
	});
	const { data: groups } = useQuery({
		queryKey: [...ADMIN_QUERY_KEY, 'access-groups'],
		queryFn: getAccessGroups,
	});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [sortBy, setSortBy] = useState<CatalogSortField>('app_id');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
	const [catalogQuery, setCatalogQuery] = useState('');
	const debouncedCatalogQ = useDebouncedValue(catalogQuery.trim(), 300);
	const catalogSearchId = useId();
	const [catalogDeleteConfirm, setCatalogDeleteConfirm] = useState<
		| null
		| { kind: 'bulk'; ids: string[] }
		| { kind: 'one'; appId: string; name: string }
	>(null);
	const [bulkCatalogDeletePending, setBulkCatalogDeletePending] =
		useState(false);
	const catalogDeleteModalDescId = useId();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const deleteMut = useMutation({
		mutationFn: deleteCatalogApp,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
			});
			toast.success(t('admin.toast.catalog'), t('admin.toast.deletedOne'));
		},
		onError: (err: Error) => toast.error(t('admin.toast.catalog'), err.message),
	});

	const handleToggleAll = (): void => {
		const list = catalog ?? [];
		if (selectedIds.length === list.length) {
			setSelectedIds([]);
		} else {
			setSelectedIds(list.map((app) => app.app_id));
		}
	};

	const handleToggleOne = (appId: string): void => {
		setSelectedIds((prev) =>
			prev.includes(appId)
				? prev.filter((id) => id !== appId)
				: [...prev, appId]
		);
	};

	const openBulkDeleteConfirm = (): void => {
		if (selectedIds.length === 0) return;
		setCatalogDeleteConfirm({ kind: 'bulk', ids: [...selectedIds] });
	};

	const runBulkCatalogDelete = async (): Promise<void> => {
		if (catalogDeleteConfirm?.kind !== 'bulk') return;
		setBulkCatalogDeletePending(true);
		try {
			await Promise.all(
				catalogDeleteConfirm.ids.map((id) => deleteCatalogApp(id))
			);
			setSelectedIds([]);
			setCatalogDeleteConfirm(null);
			await queryClient.invalidateQueries({
				queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
			});
			toast.success(t('admin.toast.catalog'), t('admin.toast.deletedBulk'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('admin.toast.catalog'), message);
		} finally {
			setBulkCatalogDeletePending(false);
		}
	};

	const handleBulkGroupApply = async (
		groupId: string | null
	): Promise<void> => {
		if (selectedIds.length === 0) return;
		try {
			await Promise.all(
				selectedIds.map((id) =>
					updateCatalogApp(id, {
						access_group_ids: groupId ? [groupId] : [],
					})
				)
			);
			setSelectedIds([]);
			setShowBulkGroupModal(false);
			await queryClient.invalidateQueries({
				queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
			});
			toast.success(t('admin.toast.catalog'), t('admin.toast.groupAssigned'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			toast.error(t('admin.toast.catalog'), message);
		}
	};

	const listRaw = catalog ?? [];

	const sortedList = useMemo(() => {
		return [...listRaw].sort((a, b) => {
			const dir = sortDir === 'asc' ? 1 : -1;
			switch (sortBy) {
				case 'app_id':
					return a.app_id.localeCompare(b.app_id) * dir;
				case 'name':
					return (a.name || '').localeCompare(b.name || '') * dir;
				case 'category':
					return (a.category || '').localeCompare(b.category || '') * dir;
				case 'is_system':
					return (Number(a.is_system) - Number(b.is_system)) * dir;
				case 'is_factory':
					return (Number(a.is_factory) - Number(b.is_factory)) * dir;
				case 'group': {
					const ga = catalogGroupsSortKey(a);
					const gb = catalogGroupsSortKey(b);
					return ga.localeCompare(gb) * dir;
				}
				default:
					return 0;
			}
		});
	}, [listRaw, sortBy, sortDir]);

	const list = useMemo(() => {
		if (!debouncedCatalogQ) return sortedList;
		const q = debouncedCatalogQ.toLowerCase();
		return sortedList.filter(
			(a) =>
				a.app_id.toLowerCase().includes(q) ||
				(a.name || '').toLowerCase().includes(q) ||
				(a.category || '').toLowerCase().includes(q) ||
				formatCatalogGroupsCell(a).toLowerCase().includes(q)
		);
	}, [sortedList, debouncedCatalogQ]);

	useEffect(() => {
		if (!catalogDeleteConfirm) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setCatalogDeleteConfirm(null);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [catalogDeleteConfirm]);

	if (isLoading) return <AdminTabLoading label={t('admin.catalog.loading')} />;

	const handleSort = (field: CatalogSortField): void => {
		setSortBy((prev) => {
			if (prev === field) {
				setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
				return prev;
			}
			setSortDir('asc');
			return field;
		});
	};

	const catalogDeleteModal = catalogDeleteConfirm ? (
		<DesktopPortaledConfirmShell
			onDismiss={() => setCatalogDeleteConfirm(null)}
			zIndex={embeddedModalZ}
			dismissAriaLabel={t('admin.deleteModalDismissAria')}
		>
			<DesktopAppModalFrame
				title={
					catalogDeleteConfirm.kind === 'bulk'
						? t('admin.bulkDeleteCatalogTitle')
						: t('admin.deleteCatalogAppTitle')
				}
				onClose={() => setCatalogDeleteConfirm(null)}
				closeLabel={t('admin.deleteModalCancel')}
				className="max-w-md shadow-lg shadow-black/20"
				role="alertdialog"
				aria-describedby={catalogDeleteModalDescId}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex flex-col gap-4 p-4">
					<p
						id={catalogDeleteModalDescId}
						className="text-sm leading-relaxed text-(--desktop-text-secondary)"
					>
						{catalogDeleteConfirm.kind === 'bulk'
							? t('admin.bulkDeleteCatalogBody', {
									count: catalogDeleteConfirm.ids.length,
								})
							: t('admin.deleteCatalogAppBody', {
									name: catalogDeleteConfirm.name,
								})}
					</p>
					<div className="flex flex-wrap justify-end gap-2">
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							disabled={
								bulkCatalogDeletePending ||
								(catalogDeleteConfirm.kind === 'one' && deleteMut.isPending)
							}
							onClick={() => setCatalogDeleteConfirm(null)}
						>
							{t('admin.deleteModalCancel')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="danger"
							size="sm"
							disabled={
								bulkCatalogDeletePending ||
								(catalogDeleteConfirm.kind === 'one' && deleteMut.isPending)
							}
							onClick={() => {
								if (catalogDeleteConfirm.kind === 'bulk') {
									void runBulkCatalogDelete();
								} else {
									deleteMut.mutate(catalogDeleteConfirm.appId, {
										onSuccess: () => setCatalogDeleteConfirm(null),
									});
								}
							}}
						>
							{bulkCatalogDeletePending ||
							(catalogDeleteConfirm.kind === 'one' && deleteMut.isPending) ? (
								<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
							) : null}
							{t('admin.deleteModalConfirm')}
						</DesktopAppButton>
					</div>
				</div>
			</DesktopAppModalFrame>
		</DesktopPortaledConfirmShell>
	) : null;

	return (
		<div className="space-y-4">
			<h2 className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'sr-only')}>
				{t('admin.catalog.srTitle')}
			</h2>
			<div className="relative max-w-md">
				<label htmlFor={catalogSearchId} className="sr-only">
					{t('search.label')}
				</label>
				<MagnifyingGlassIcon
					className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim)"
					aria-hidden
				/>
				<DesktopAppInput
					id={catalogSearchId}
					type="search"
					value={catalogQuery}
					onChange={(e) => setCatalogQuery(e.target.value)}
					placeholder={t('search.placeholder')}
					autoComplete="off"
					className="py-2.5 pl-9"
				/>
			</div>
			<div className="flex items-center justify-between gap-3">
				<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'flex items-center gap-2')}>
					{selectedIds.length > 0 ? (
						<span className="text-(--desktop-text-primary)">
							{selectedIds.length} {t('admin.common.selected')}
						</span>
					) : (
						<span className="opacity-70">
							{t('admin.common.bulkActionsHint')}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{selectedIds.length > 0 && (
						<>
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								className="gap-2 text-xs"
								onClick={() => setShowBulkGroupModal(true)}
							>
								<KeyIcon className="h-3.5 w-3.5" />
								{t('admin.catalog.assignGroup')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="danger"
								size="sm"
								className="gap-2 text-xs"
								onClick={openBulkDeleteConfirm}
							>
								<TrashIcon className="h-3.5 w-3.5" />
								{t('admin.catalog.deleteSelected')}
							</DesktopAppButton>
						</>
					)}
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="md"
						className="gap-2"
						onClick={() => setCreateOpen(true)}
					>
						<PlusIcon className="h-4 w-4" />
						{t('admin.catalog.addApp')}
					</DesktopAppButton>
				</div>
			</div>
			{list.length === 0 ? (
				<div className={adminUiTableWrapClass}>
					<DesktopAppEmptyState
						icon={
							<CubeIcon
								className="h-10 w-10 text-(--desktop-text-muted)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title={t('admin.catalog.emptyTitle')}
						description={t('admin.catalog.emptyDesc')}
					/>
				</div>
			) : (
				<div className={adminUiTableWrapClass}>
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-(--desktop-border-subtle)">
								<th scope="col" className="p-3 w-10">
									<input
										type="checkbox"
										className={cn(
											'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
											adminUiFocusRing
										)}
										aria-label={t('admin.common.selectAll')}
										checked={
											list.length > 0 && selectedIds.length === list.length
										}
										onChange={handleToggleAll}
									/>
								</th>
								<th scope="col" className="w-12 p-3">
									<span className="sr-only">{t('admin.catalog.colIcon')}</span>
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'app_id'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown('app_id', handleSort)}
									onClick={() => handleSort('app_id')}
								>
									app_id{' '}
									{sortBy === 'app_id' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'name'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown('name', handleSort)}
									onClick={() => handleSort('name')}
								>
									{t('admin.catalog.colName')}{' '}
									{sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'category'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown('category', handleSort)}
									onClick={() => handleSort('category')}
								>
									{t('admin.catalog.colCategory')}{' '}
									{sortBy === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'is_system'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown(
										'is_system',
										handleSort
									)}
									onClick={() => handleSort('is_system')}
								>
									{t('admin.catalog.colSystem')}{' '}
									{sortBy === 'is_system'
										? sortDir === 'asc'
											? '↑'
											: '↓'
										: ''}
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'is_factory'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown(
										'is_factory',
										handleSort
									)}
									onClick={() => handleSort('is_factory')}
								>
									{t('admin.catalog.colFactory')}{' '}
									{sortBy === 'is_factory'
										? sortDir === 'asc'
											? '↑'
											: '↓'
										: ''}
								</th>
								<th scope="col" className="p-3 whitespace-nowrap">
									{t('admin.catalog.colEwMonth')}
								</th>
								<th scope="col" className="p-3 whitespace-nowrap">
									{t('admin.catalog.colTrialDays')}
								</th>
								<th scope="col" className="p-3 whitespace-nowrap">
									{t('admin.catalog.colWindows')}
								</th>
								<th
									scope="col"
									className={cn(
										'p-3 cursor-pointer select-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									aria-sort={
										sortBy === 'group'
											? sortDir === 'asc'
												? 'ascending'
												: 'descending'
											: 'none'
									}
									tabIndex={0}
									onKeyDown={sortableAdminColumnKeyDown('group', handleSort)}
									onClick={() => handleSort('group')}
								>
									{t('admin.catalog.colGroups')}{' '}
									{sortBy === 'group' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
								</th>
								<th scope="col" className="p-3">
									{t('admin.common.actions')}
								</th>
							</tr>
						</thead>
						<tbody>
							{list.map((app) => (
								<tr
									key={app.app_id}
									className={cn(
										'border-b border-(--desktop-border-subtle)',
										'hover:bg-[var(--admin-ui-surface-strong)]'
									)}
								>
									<td className="p-3 align-middle">
										<input
											type="checkbox"
											className={cn(
												'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
												adminUiFocusRing
											)}
											checked={selectedIds.includes(app.app_id)}
											onChange={() => handleToggleOne(app.app_id)}
											aria-label={t('admin.common.selectApp', {
												name: app.name,
											})}
										/>
									</td>
									<td className="p-3 align-middle">
										<AdminCatalogAppIcon app={app} size="sm" />
									</td>
									<td className="p-3 font-mono text-xs">{app.app_id}</td>
									<td className="p-3">
										<div className="flex flex-col gap-1">
											<span>{app.name}</span>
											{(app.is_featured_new || app.maintenance_mode) && (
												<div className="flex flex-wrap gap-1.5">
													{app.is_featured_new ? (
														<span className="rounded-md border border-[color-mix(in_srgb,rgb(59_130_246)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(59_130_246)_12%)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,rgb(59_130_246)_70%,var(--desktop-text-primary))]">
															{t('admin.catalog.badgeNew')}
														</span>
													) : null}
													{app.maintenance_mode ? (
														<span className="rounded-md border border-[color-mix(in_srgb,rgb(245_158_11)_42%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(245_158_11)_12%)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,rgb(245_158_11)_58%,var(--desktop-text-primary))]">
															{t('admin.catalog.badgeMaintenance')}
														</span>
													) : null}
												</div>
											)}
										</div>
									</td>
									<td className="p-3">{app.category}</td>
									<td className="p-3">
										{app.is_system
											? t('admin.common.yes')
											: t('admin.common.no')}
									</td>
									<td className="p-3">
										{app.is_factory
											? t('admin.common.yes')
											: t('admin.common.no')}
									</td>
									<td className="p-3 tabular-nums">
										{app.ew_monthly_price ?? 0}
									</td>
									<td className="p-3 tabular-nums">
										{app.trial_duration_days ?? 0}
									</td>
									<td className="p-3 whitespace-nowrap">
										{app.allow_multiple_windows
											? t('admin.common.windowsUntil', {
													count: app.max_window_instances ?? 1,
												})
											: '1'}
									</td>
									<td className="p-3">{formatCatalogGroupsCell(app)}</td>
									<td className="p-3 flex gap-2">
										<DesktopChromeTooltip
											content={t('admin.common.edit')}
											placement="top"
											offsetExtra={4}
										>
											<button
												type="button"
												onClick={() => setEditingId(app.app_id)}
												className={cn(
													'p-1.5 rounded hover:bg-(--desktop-surface-soft)',
													DESKTOP_INTERACTIVE.focusRing
												)}
												aria-label={t('admin.common.edit')}
											>
												<PencilIcon className="w-4 h-4" />
											</button>
										</DesktopChromeTooltip>
										<DesktopChromeTooltip
											content={t('admin.common.delete')}
											placement="top"
											offsetExtra={4}
										>
											<button
												type="button"
												onClick={() =>
													setCatalogDeleteConfirm({
														kind: 'one',
														appId: app.app_id,
														name: app.name,
													})
												}
												disabled={deleteMut.isPending}
												className={cn(
													'p-1.5 rounded text-red-300 hover:bg-red-500/20',
													DESKTOP_INTERACTIVE.focusRing
												)}
												aria-label={t('admin.common.delete')}
											>
												<TrashIcon className="w-4 h-4" />
											</button>
										</DesktopChromeTooltip>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{showBulkGroupModal && (
				<BulkGroupModal
					groups={groups ?? []}
					onClose={() => setShowBulkGroupModal(false)}
					onApply={handleBulkGroupApply}
				/>
			)}
			{createOpen && (
				<CatalogForm
					groups={groups ?? []}
					onClose={() => setCreateOpen(false)}
					onSuccess={() => {
						setCreateOpen(false);
						queryClient.invalidateQueries({
							queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
						});
					}}
				/>
			)}
			{editingId && (
				<CatalogEditForm
					appId={editingId}
					app={list.find((a) => a.app_id === editingId) ?? null}
					groups={groups ?? []}
					onClose={() => setEditingId(null)}
					onSuccess={() => {
						setEditingId(null);
						queryClient.invalidateQueries({
							queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
						});
					}}
				/>
			)}
			{catalogDeleteModal}
		</div>
	);
}
