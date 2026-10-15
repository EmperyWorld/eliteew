/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin access-groups list tab (New World table + DangerConfirm).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	KeyIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notify as toast } from '@/notifications';
import {
	AdminButton,
	DangerConfirmModal,
	adminUiFocusRing,
	adminUiTableWrapClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { DesktopAppEmptyState } from '../components/DesktopAppChrome';
import { DesktopChromeTooltip } from '../components/DesktopChromeTooltip';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	deleteAccessGroup,
	getAccessGroups,
} from '../services/desktopAdminApi';
import { ADMIN_QUERY_KEY } from './adminQueryKeys';
import { AdminTabLoading } from './AdminTabLoading';
import { GroupEditForm } from './GroupEditForm';
import { GroupForm } from './GroupForm';

export function AccessGroupsTab(): React.ReactElement {
	const { t } = useTranslation('appStore');
	const queryClient = useQueryClient();
	const { data: groups, isLoading } = useQuery({
		queryKey: [...ADMIN_QUERY_KEY, 'access-groups'],
		queryFn: getAccessGroups,
	});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [groupDeleteConfirm, setGroupDeleteConfirm] = useState<null | {
		id: string;
		name: string;
	}>(null);

	const deleteMut = useMutation({
		mutationFn: deleteAccessGroup,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [...ADMIN_QUERY_KEY, 'access-groups'],
			});
			toast.success(t('admin.toast.groups'), t('admin.toast.groupDeleted'));
		},
		onError: (err: Error) => toast.error(t('admin.toast.groups'), err.message),
	});

	if (isLoading) return <AdminTabLoading label={t('admin.groups.loading')} />;
	const list = groups ?? [];

	return (
		<div className="space-y-4">
			<h2 className="sr-only text-[var(--admin-ui-fg)]">
				{t('admin.groups.title')}
			</h2>
			<div className="flex justify-end">
				<AdminButton
					variant="secondary"
					className="gap-2"
					onClick={() => setCreateOpen(true)}
				>
					<PlusIcon className="h-4 w-4" />
					{t('admin.groups.addGroup')}
				</AdminButton>
			</div>
			{list.length === 0 ? (
				<div className={adminUiTableWrapClass}>
					<DesktopAppEmptyState
						icon={
							<KeyIcon
								className="h-10 w-10 text-[var(--admin-ui-fg-muted)]"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title={t('admin.groups.emptyTitle')}
						description={t('admin.groups.emptyDesc')}
					/>
				</div>
			) : (
				<div className={adminUiTableWrapClass}>
					<table className="w-full text-left text-sm text-[var(--admin-ui-fg)]">
						<thead>
							<tr className="border-b border-[var(--admin-ui-border)]">
								<th scope="col" className="p-3">
									{t('admin.common.name')}
								</th>
								<th scope="col" className="p-3">
									{t('admin.common.description')}
								</th>
								<th scope="col" className="p-3">
									{t('admin.common.actions')}
								</th>
							</tr>
						</thead>
						<tbody>
							{list.map((g) => (
								<tr
									key={g.id}
									className="border-b border-[var(--admin-ui-border)] hover:bg-[var(--admin-ui-surface-strong)]"
								>
									<td className="p-3">{g.name}</td>
									<td className="p-3 text-[var(--admin-ui-fg-muted)]">
										{g.description ?? '—'}
									</td>
									<td className="flex gap-2 p-3">
										<DesktopChromeTooltip
											content={t('admin.common.edit')}
											placement="top"
											offsetExtra={4}
										>
											<button
												type="button"
												onClick={() => setEditingId(g.id)}
												className={cn(
													'rounded p-1.5 hover:bg-[var(--admin-ui-surface)]',
													adminUiFocusRing
												)}
												aria-label={t('admin.common.edit')}
											>
												<PencilIcon className="h-4 w-4" />
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
													setGroupDeleteConfirm({ id: g.id, name: g.name })
												}
												disabled={deleteMut.isPending}
												className={cn(
													'rounded p-1.5 text-[var(--admin-ui-status-danger)] hover:bg-[var(--admin-ui-status-danger-bg)]',
													adminUiFocusRing
												)}
												aria-label={t('admin.common.delete')}
											>
												<TrashIcon className="h-4 w-4" />
											</button>
										</DesktopChromeTooltip>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{createOpen && (
				<GroupForm
					onClose={() => setCreateOpen(false)}
					onSuccess={() => {
						setCreateOpen(false);
						queryClient.invalidateQueries({
							queryKey: [...ADMIN_QUERY_KEY, 'access-groups'],
						});
					}}
				/>
			)}
			{editingId && (
				<GroupEditForm
					groupId={editingId}
					group={list.find((x) => x.id === editingId) ?? null}
					onClose={() => setEditingId(null)}
					onSuccess={() => {
						setEditingId(null);
						queryClient.invalidateQueries({
							queryKey: [...ADMIN_QUERY_KEY, 'access-groups'],
						});
					}}
				/>
			)}
			<DangerConfirmModal
				open={Boolean(groupDeleteConfirm)}
				title={t('admin.deleteGroupTitle')}
				description={
					groupDeleteConfirm
						? t('admin.deleteGroupBody', { name: groupDeleteConfirm.name })
						: undefined
				}
				confirmPhrase={groupDeleteConfirm?.name ?? 'DELETE'}
				confirmLabel={t('admin.deleteModalConfirm')}
				cancelLabel={t('admin.deleteModalCancel')}
				busy={deleteMut.isPending}
				onCancel={() => setGroupDeleteConfirm(null)}
				onConfirm={() => {
					if (!groupDeleteConfirm) return;
					deleteMut.mutate(groupDeleteConfirm.id, {
						onSuccess: () => setGroupDeleteConfirm(null),
					});
				}}
			/>
		</div>
	);
}
