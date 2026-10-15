/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edit catalog app modal form (New World tokens; desktop portal z-index preserved).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */
import { useMutation } from '@tanstack/react-query';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../context/DesktopWindowPortalStackContext';
import type {
	AccessGroupResponse,
	CatalogAppResponse,
	CatalogAppUpdate,
} from '../services/desktopAdminApi';
import {
	buildCatalogPatchPayload,
	updateCatalogApp,
} from '../services/desktopAdminApi';
import { notify as toast } from '@/notifications';
import {
	AdminButton,
	AdminSelect,
	adminUiFieldClass,
	adminUiFocusRing,
	adminUiModalBackdropClass,
	adminUiModalPanelClass,
} from '@/pages/Admin/ui';
import { AppStoreAdminCatalogCardPreview } from '../components/AppStoreAdminCatalogCardPreview';
import { AppComponentDatalist } from './adminHelpers';

export function CatalogEditForm({
	appId,
	app,
	groups,
	onClose,
	onSuccess,
}: {
	appId: string;
	app: CatalogAppResponse | null;
	groups: AccessGroupResponse[];
	onClose: () => void;
	onSuccess: () => void;
}): React.ReactElement {
	const { t } = useTranslation('appStore');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [form, setForm] = useState<CatalogAppUpdate>({
		name: app?.name ?? '',
		description: app?.description ?? null,
		app_component: app?.app_component ?? '',
		category: app?.category ?? 'productivity',
		sort_order: app?.sort_order ?? 0,
		allow_multiple_windows: app?.allow_multiple_windows ?? false,
		max_window_instances: app?.max_window_instances ?? 1,
		is_system: app?.is_system ?? false,
		is_factory: app?.is_factory ?? false,
		ew_monthly_price: app?.ew_monthly_price ?? 0,
		trial_duration_days: app?.trial_duration_days ?? 0,
		icon_url: app?.icon_url ?? null,
		icon_url_2x: app?.icon_url_2x ?? null,
		preview_url: app?.preview_url ?? null,
		preview_url_2x: app?.preview_url_2x ?? null,
		access_group_ids: (app?.access_groups ?? []).map((g) => g.id),
	});
	React.useEffect(() => {
		if (app) {
			setForm({
				name: app.name,
				description: app.description,
				app_component: app.app_component,
				category: app.category,
				sort_order: app.sort_order,
				allow_multiple_windows: app.allow_multiple_windows ?? false,
				max_window_instances: app.max_window_instances ?? 1,
				is_system: app.is_system,
				is_factory: app.is_factory ?? false,
				ew_monthly_price: app.ew_monthly_price ?? 0,
				trial_duration_days: app.trial_duration_days ?? 0,
				icon_url: app.icon_url ?? null,
				icon_url_2x: app.icon_url_2x ?? null,
				preview_url: app.preview_url ?? null,
				preview_url_2x: app.preview_url_2x ?? null,
				access_group_ids: (app.access_groups ?? []).map((g) => g.id),
			});
		}
	}, [app]);
	const updateMut = useMutation({
		mutationFn: (data: CatalogAppUpdate) => updateCatalogApp(appId, data),
		onSuccess: () => {
			toast.success(t('admin.toast.catalog'), t('admin.toast.updated'));
			onSuccess();
		},
		onError: (err: Error) => toast.error(t('admin.toast.catalog'), err.message),
	});
	const submitCatalogEdit = useCallback(() => {
		if (!app) return;
		const patch = buildCatalogPatchPayload(app, form);
		if (Object.keys(patch).length === 0) {
			toast.info(t('admin.toast.catalog'), t('admin.toast.noChanges'));
			return;
		}
		updateMut.mutate(patch);
	}, [app, form, updateMut, t]);
	const eid = useId();
	const editName = `${eid}-name`;
	const editAppComponent = `${eid}-app-component`;
	const editCategory = `${eid}-category`;
	const editEwMonthly = `${eid}-ew-monthly`;
	const editTrialDays = `${eid}-trial-days`;
	const editAllowMultiWindows = `${eid}-allow-multi-windows`;
	const editMaxWindowInstances = `${eid}-max-window-instances`;
	const editIconUrl = `${eid}-icon-url`;
	const editIconUrl2x = `${eid}-icon-url-2x`;
	const editPreviewUrl = `${eid}-preview-url`;
	const editPreviewUrl2x = `${eid}-preview-url-2x`;
	const submitErrId = `${eid}-catalog-edit-error`;
	const submitMessage =
		updateMut.isError && updateMut.error instanceof Error
			? updateMut.error.message
			: null;
	const fieldInvalid = Boolean(submitMessage);

	const touchForm = useCallback(
		(next: (prev: CatalogAppUpdate) => CatalogAppUpdate) => {
			updateMut.reset();
			setForm(next);
		},
		[updateMut]
	);

	if (!app)
		return (
			<div className="text-(--desktop-text-muted)">
				{t('admin.catalog.notFound')}
			</div>
		);

	return (
		<div
			className={adminUiModalBackdropClass}
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			<div
				className={cn(adminUiModalPanelClass, 'relative max-w-lg lg:max-w-3xl')}
				style={{ zIndex: embeddedModalZ.content }}
			>
				<h3 className="mb-4 text-lg font-semibold text-(--desktop-text-primary)">
					{t('admin.catalog.editTitle', { appId: app.app_id })}
				</h3>
				{submitMessage ? (
					<p
						id={submitErrId}
						role="alert"
						className="mb-3 text-sm text-[color-mix(in_srgb,rgb(252_165_165)_85%,var(--desktop-text-primary))]"
					>
						{t('admin.formError', { message: submitMessage })}
					</p>
				) : null}
				<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_228px] lg:items-start lg:gap-5">
					<div className="space-y-3">
						<label
							htmlFor={editName}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.common.name')}
						</label>
						<input
							id={editName}
							type="text"
							value={form.name ?? ''}
							onChange={(e) =>
								touchForm((p) => ({ ...p, name: e.target.value }))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<label
							htmlFor={editAppComponent}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							app_component
						</label>
						<input
							id={editAppComponent}
							type="text"
							value={form.app_component ?? ''}
							onChange={(e) =>
								touchForm((p) => ({ ...p, app_component: e.target.value }))
							}
							list="desktop-app-component-options"
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<AppComponentDatalist />
						<p className="text-xs text-(--desktop-text-dim)">
							{t('admin.form.appComponentHintEdit')}
						</p>
						<label
							htmlFor={editCategory}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.common.category')}
						</label>
						<AdminSelect
							id={editCategory}
							value={form.category ?? ''}
							onChange={(e) =>
								touchForm((p) => ({ ...p, category: e.target.value }))
							}
							className="w-full"
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						>
							<option
								value="communication"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								communication
							</option>
							<option
								value="productivity"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								productivity
							</option>
							<option
								value="widgets"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								widgets
							</option>
							<option
								value="developer"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								developer
							</option>
							<option
								value="home"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								home
							</option>
							<option
								value="system"
								className="bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)"
							>
								system
							</option>
						</AdminSelect>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={form.is_system ?? false}
								onChange={(e) =>
									touchForm((p) => ({
										...p,
										is_system: e.target.checked,
										...(e.target.checked ? { is_factory: false } : {}),
									}))
								}
								className={cn(
									'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
									adminUiFocusRing
								)}
								aria-describedby={fieldInvalid ? submitErrId : undefined}
							/>
							{t('admin.catalog.colSystem')}
						</label>
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={form.is_factory ?? false}
								onChange={(e) =>
									touchForm((p) => ({
										...p,
										is_factory: e.target.checked,
										...(e.target.checked
											? {
													is_system: false,
													ew_monthly_price: 0,
													trial_duration_days: 0,
												}
											: {}),
									}))
								}
								className={cn(
									'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
									adminUiFocusRing
								)}
								aria-describedby={fieldInvalid ? submitErrId : undefined}
							/>
							{t('admin.catalog.colFactory')}
						</label>
						<label className="flex items-center gap-2">
							<input
								id={editAllowMultiWindows}
								type="checkbox"
								checked={form.allow_multiple_windows ?? false}
								onChange={(e) =>
									touchForm((p) => ({
										...p,
										allow_multiple_windows: e.target.checked,
										max_window_instances: e.target.checked
											? Math.max(1, Number(p.max_window_instances) || 1)
											: 1,
									}))
								}
								className={cn(
									'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
									adminUiFocusRing
								)}
								aria-describedby={fieldInvalid ? submitErrId : undefined}
							/>
							{t('admin.form.allowMultipleWindows')}
						</label>
						<label
							htmlFor={editMaxWindowInstances}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.maxWindowInstances')}
						</label>
						<input
							id={editMaxWindowInstances}
							type="number"
							min={1}
							step={1}
							value={form.max_window_instances ?? 1}
							disabled={!form.allow_multiple_windows}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									max_window_instances: Math.max(
										1,
										Number.parseInt(e.target.value || '1', 10) || 1
									),
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<p className="text-xs text-(--desktop-text-dim)">
							{t('admin.form.factoryHint')}
						</p>
						<label
							htmlFor={editEwMonthly}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.ewMonthlyPriceEdit')}
						</label>
						<input
							id={editEwMonthly}
							type="number"
							min={0}
							value={form.ew_monthly_price ?? 0}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									ew_monthly_price: Number(e.target.value) || 0,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<label
							htmlFor={editTrialDays}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.trialDaysEdit')}
						</label>
						<input
							id={editTrialDays}
							type="number"
							min={0}
							value={form.trial_duration_days ?? 0}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									trial_duration_days: Number(e.target.value) || 0,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'text-(--desktop-text-dim) -mt-1'
							)}
						>
							{t('admin.form.storefrontUrlsHintEdit')}
						</p>
						<label
							htmlFor={editIconUrl}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.iconUrl1x')}
						</label>
						<input
							id={editIconUrl}
							type="url"
							inputMode="url"
							placeholder="https://"
							value={form.icon_url ?? ''}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									icon_url: e.target.value.trim() || null,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
							autoComplete="off"
						/>
						<label
							htmlFor={editIconUrl2x}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.iconUrl2x')}
						</label>
						<input
							id={editIconUrl2x}
							type="url"
							inputMode="url"
							placeholder="https://"
							value={form.icon_url_2x ?? ''}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									icon_url_2x: e.target.value.trim() || null,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
							autoComplete="off"
						/>
						<label
							htmlFor={editPreviewUrl}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.previewUrl')}
						</label>
						<input
							id={editPreviewUrl}
							type="url"
							inputMode="url"
							placeholder="https://"
							value={form.preview_url ?? ''}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									preview_url: e.target.value.trim() || null,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
							autoComplete="off"
						/>
						<label
							htmlFor={editPreviewUrl2x}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.previewUrl2x')}
						</label>
						<input
							id={editPreviewUrl2x}
							type="url"
							inputMode="url"
							placeholder="https://"
							value={form.preview_url_2x ?? ''}
							onChange={(e) =>
								touchForm((p) => ({
									...p,
									preview_url_2x: e.target.value.trim() || null,
								}))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
							autoComplete="off"
						/>
						<fieldset
							className="m-0 min-w-0 space-y-2 border-0 p-0"
							aria-labelledby={`${eid}-edit-access-groups-label`}
							aria-describedby={
								fieldInvalid ? submitErrId : `${eid}-edit-access-groups-hint`
							}
						>
							<span
								id={`${eid}-edit-access-groups-label`}
								className="block text-sm text-(--desktop-text-muted) antialiased"
							>
								{t('admin.catalog.colGroups')}
							</span>
							<p
								id={`${eid}-edit-access-groups-hint`}
								className="text-xs text-(--desktop-text-dim)"
							>
								{t('admin.form.accessGroupsHintEdit')}
							</p>
							<div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-(--desktop-border-subtle) p-2">
								{groups.map((g) => (
									<label
										key={g.id}
										className="flex cursor-pointer items-center gap-2 text-sm"
									>
										<input
											type="checkbox"
											className={cn(
												'h-4 w-4 shrink-0 rounded border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
												adminUiFocusRing
											)}
											checked={(form.access_group_ids ?? []).includes(g.id)}
											onChange={(e) =>
												touchForm((p) => ({
													...p,
													access_group_ids: e.target.checked
														? [...(p.access_group_ids ?? []), g.id]
														: (p.access_group_ids ?? []).filter(
																(x) => x !== g.id
															),
												}))
											}
										/>
										{g.name}
									</label>
								))}
							</div>
						</fieldset>
					</div>
					<div className="mt-4 lg:mt-0">
						<AppStoreAdminCatalogCardPreview
							name={form.name ?? app.name}
							category={form.category ?? app.category}
							description={form.description}
							iconUrl={form.icon_url}
							iconUrl2x={form.icon_url_2x}
							previewUrl={form.preview_url}
							previewUrl2x={form.preview_url_2x}
							gradient={app.gradient}
						/>
					</div>
				</div>
				<div className="mt-6 flex gap-2">
					<AdminButton
						type="button"
						variant="primary"
						onClick={submitCatalogEdit}
						disabled={updateMut.isPending}
					>
						{updateMut.isPending
							? t('admin.common.saving')
							: t('admin.common.save')}
					</AdminButton>
					<AdminButton type="button" variant="ghost" onClick={onClose}>
						{t('admin.common.cancel')}
					</AdminButton>
				</div>
			</div>
		</div>
	);
}
