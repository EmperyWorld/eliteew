/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App Store admin maintenance-mode tab (New World atoms).
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
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { AdminCatalogAppIcon } from '../components/AdminCatalogAppIcon';
import {
	DesktopAppEmptyState,
	DesktopAppSkeleton,
} from '../components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	buildCatalogPatchPayload,
	getCatalog,
	updateCatalogApp,
} from '../services/desktopAdminApi';
import { ADMIN_QUERY_KEY } from './adminQueryKeys';

export function MaintenanceAdminTab(): React.ReactElement {
	const { t } = useTranslation('appStore');
	const queryClient = useQueryClient();
	const { data: catalog, isLoading } = useQuery({
		queryKey: [...ADMIN_QUERY_KEY, 'catalog'],
		queryFn: getCatalog,
	});
	const [draft, setDraft] = useState<
		Record<
			string,
			{
				maintenance_mode: boolean;
				maintenance_title: string;
				maintenance_reason: string;
				maintenance_expected_outcome: string;
				maintenance_eta_note: string;
			}
		>
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
						maintenance_mode: a.maintenance_mode ?? false,
						maintenance_title: a.maintenance_title ?? '',
						maintenance_reason: a.maintenance_reason ?? '',
						maintenance_expected_outcome: a.maintenance_expected_outcome ?? '',
						maintenance_eta_note: a.maintenance_eta_note ?? '',
					},
				])
			)
		);
	}, [catalog]);

	const saveMut = useMutation({
		mutationFn: async ({
			app,
		}: {
			app: NonNullable<typeof catalog>[number];
		}) => {
			const d = draft[app.app_id];
			if (!d) {
				return;
			}
			const payload = buildCatalogPatchPayload(app, {
				maintenance_mode: d.maintenance_mode,
				maintenance_title: d.maintenance_title.trim() || null,
				maintenance_reason: d.maintenance_reason.trim() || null,
				maintenance_expected_outcome:
					d.maintenance_expected_outcome.trim() || null,
				maintenance_eta_note: d.maintenance_eta_note.trim() || null,
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
			toast.success(t('admin.toast.maintenance'), t('admin.toast.saved'));
		},
		onError: (err: Error) =>
			toast.error(t('admin.toast.maintenance'), err.message),
	});

	if (isLoading) {
		return <DesktopAppSkeleton className="h-40 w-full max-w-3xl" />;
	}
	if (!catalog?.length) {
		return (
			<DesktopAppEmptyState
				title={t('admin.maintenance.emptyTitle')}
				description={t('admin.maintenance.emptyDesc')}
			/>
		);
	}

	return (
		<div className="mx-auto max-w-4xl space-y-4">
			<p className="text-sm text-[var(--admin-ui-fg-muted)]">
				{t('admin.maintenance.intro')}
			</p>
			<div className="space-y-6">
				{catalog.map((app) => {
					const d = draft[app.app_id];
					if (!d) {
						return null;
					}
					return (
						<section
							key={app.app_id}
							className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4"
						>
							<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-3">
									<AdminCatalogAppIcon app={app} />
									<div>
										<p className="font-semibold text-[var(--admin-ui-fg)]">
											{app.name}
										</p>
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'font-mono text-[var(--admin-ui-fg-muted)]'
											)}
										>
											{app.app_id}
										</p>
									</div>
								</div>
								<AdminToggle
									id={`maint-mode-${app.app_id}`}
									checked={d.maintenance_mode}
									label={t('admin.maintenance.mode')}
									onChange={(e) =>
										setDraft((prev) => ({
											...prev,
											[app.app_id]: {
												...d,
												maintenance_mode: e.target.checked,
											},
										}))
									}
								/>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-1">
									<label
										className="text-sm text-[var(--admin-ui-fg)]"
										htmlFor={`maint-title-${app.app_id}`}
									>
										{t('admin.maintenance.title')}
									</label>
									<AdminField
										id={`maint-title-${app.app_id}`}
										value={d.maintenance_title}
										onChange={(e) =>
											setDraft((prev) => ({
												...prev,
												[app.app_id]: {
													...d,
													maintenance_title: e.target.value,
												},
											}))
										}
									/>
								</div>
								<div className="grid gap-1">
									<label
										className="text-sm text-[var(--admin-ui-fg)]"
										htmlFor={`maint-eta-${app.app_id}`}
									>
										{t('admin.maintenance.eta')}
									</label>
									<AdminField
										id={`maint-eta-${app.app_id}`}
										value={d.maintenance_eta_note}
										onChange={(e) =>
											setDraft((prev) => ({
												...prev,
												[app.app_id]: {
													...d,
													maintenance_eta_note: e.target.value,
												},
											}))
										}
									/>
								</div>
							</div>
							<div className="mt-3 grid gap-1">
								<label
									className="text-sm text-[var(--admin-ui-fg)]"
									htmlFor={`maint-reason-${app.app_id}`}
								>
									{t('admin.maintenance.reason')}
								</label>
								<textarea
									id={`maint-reason-${app.app_id}`}
									className={cn(adminUiFieldClass, 'min-h-16 w-full resize-y')}
									value={d.maintenance_reason}
									onChange={(e) =>
										setDraft((prev) => ({
											...prev,
											[app.app_id]: {
												...d,
												maintenance_reason: e.target.value,
											},
										}))
									}
									aria-label={t('admin.maintenance.reasonAria')}
								/>
							</div>
							<div className="mt-3 grid gap-1">
								<label
									className="text-sm text-[var(--admin-ui-fg)]"
									htmlFor={`maint-outcome-${app.app_id}`}
								>
									{t('admin.maintenance.expectedOutcome')}
								</label>
								<textarea
									id={`maint-outcome-${app.app_id}`}
									className={cn(adminUiFieldClass, 'min-h-16 w-full resize-y')}
									value={d.maintenance_expected_outcome}
									onChange={(e) =>
										setDraft((prev) => ({
											...prev,
											[app.app_id]: {
												...d,
												maintenance_expected_outcome: e.target.value,
											},
										}))
									}
									aria-label={t('admin.maintenance.expectedOutcomeAria')}
								/>
							</div>
							<div className="mt-3 flex justify-end">
								<AdminButton
									variant="primary"
									disabled={saveMut.isPending}
									onClick={() => saveMut.mutate({ app })}
								>
									{t('admin.common.save')}
								</AdminButton>
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
