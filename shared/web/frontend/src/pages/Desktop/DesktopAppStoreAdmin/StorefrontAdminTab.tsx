/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin storefront badges tab (New World atoms).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notify as toast } from '@/notifications';
import {
	AdminButton,
	AdminField,
	AdminToggle,
	adminUiTableWrapClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { AdminCatalogAppIcon } from '../components/AdminCatalogAppIcon';
import {
	DesktopAppEmptyState,
	DesktopAppSkeleton,
} from '../components/DesktopAppChrome';
import {
	buildCatalogPatchPayload,
	getCatalog,
	type CatalogAppResponse,
	updateCatalogApp,
} from '../services/desktopAdminApi';
import { isoToDatetimeLocalValue } from './adminHelpers';
import { ADMIN_QUERY_KEY } from './adminQueryKeys';

export function StorefrontAdminTab(): React.ReactElement {
	const { t } = useTranslation('appStore');
	const queryClient = useQueryClient();
	const { data: catalog, isLoading } = useQuery({
		queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
		queryFn: getCatalog,
	});
	const [draft, setDraft] = useState<
		Record<string, { is_featured_new: boolean; new_until: string }>
	>({});

	useEffect(() => {
		if (!catalog) {
			return;
		}
		setDraft(
			Object.fromEntries(
				catalog.map((a) => [
					a.app_id,
					{
						is_featured_new: a.is_featured_new ?? false,
						new_until: isoToDatetimeLocalValue(a.new_until ?? null),
					},
				])
			)
		);
	}, [catalog]);

	const saveMut = useMutation({
		mutationFn: async ({ app }: { app: CatalogAppResponse }) => {
			const d = draft[app.app_id];
			if (!d) {
				return;
			}
			const nu = d.new_until.trim();
			const payload = buildCatalogPatchPayload(app, {
				is_featured_new: d.is_featured_new,
				new_until: nu ? new Date(nu).toISOString() : null,
			});
			if (Object.keys(payload).length === 0) {
				return;
			}
			await updateCatalogApp(app.app_id, payload);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
			});
			void queryClient.invalidateQueries({ queryKey: ['desktop', 'store'] });
			toast.success(t('admin.toast.storefront'), t('admin.toast.saved'));
		},
		onError: (err: Error) =>
			toast.error(t('admin.toast.storefront'), err.message),
	});

	if (isLoading) {
		return <DesktopAppSkeleton className="h-40 w-full max-w-3xl" />;
	}
	if (!catalog?.length) {
		return (
			<DesktopAppEmptyState
				title={t('admin.storefront.emptyTitle')}
				description={t('admin.storefront.emptyDesc')}
			/>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-4">
			<p className="text-sm text-[var(--admin-ui-fg-muted)]">
				{t('admin.storefront.intro')}
			</p>
			<div className={cn(adminUiTableWrapClass, 'overflow-x-auto')}>
				<table className="min-w-full text-left text-sm text-[var(--admin-ui-fg)]">
					<thead>
						<tr className="border-b border-[var(--admin-ui-border)]">
							<th className="w-12 p-2 font-medium">
								<span className="sr-only">{t('admin.storefront.iconCol')}</span>
							</th>
							<th className="p-2 font-medium">app_id</th>
							<th className="p-2 font-medium">{t('admin.common.name')}</th>
							<th className="p-2 font-medium">{t('admin.common.newBadge')}</th>
							<th className="p-2 font-medium">{t('admin.common.showUntil')}</th>
							<th className="p-2 font-medium" />
						</tr>
					</thead>
					<tbody>
						{catalog.map((app) => {
							const d = draft[app.app_id];
							if (!d) {
								return null;
							}
							return (
								<tr
									key={app.app_id}
									className={cn(
										'border-b border-[var(--admin-ui-border)]/60',
										'hover:bg-[var(--admin-ui-surface-strong)]',
										d.is_featured_new &&
											'border-l-[3px] border-l-[var(--admin-ui-accent)] bg-[var(--admin-ui-accent)]/5'
									)}
								>
									<td className="p-2">
										<AdminCatalogAppIcon app={app} />
									</td>
									<td className="p-2 font-mono text-xs">{app.app_id}</td>
									<td className="p-2">{app.name}</td>
									<td className="p-2">
										<AdminToggle
											id={`storefront-new-${app.app_id}`}
											checked={d.is_featured_new}
											label={t('admin.common.badge')}
											onChange={(e) =>
												setDraft((prev) => ({
													...prev,
													[app.app_id]: {
														...d,
														is_featured_new: e.target.checked,
													},
												}))
											}
										/>
									</td>
									<td className="p-2">
										<AdminField
											type="datetime-local"
											value={d.new_until}
											onChange={(e) =>
												setDraft((prev) => ({
													...prev,
													[app.app_id]: {
														...d,
														new_until: e.target.value,
													},
												}))
											}
											aria-label={t('admin.storefront.newUntilAria')}
											className="max-w-56"
										/>
									</td>
									<td className="p-2">
										<AdminButton
											variant="primary"
											disabled={saveMut.isPending}
											onClick={() => saveMut.mutate({ app })}
										>
											{t('admin.common.save')}
										</AdminButton>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
