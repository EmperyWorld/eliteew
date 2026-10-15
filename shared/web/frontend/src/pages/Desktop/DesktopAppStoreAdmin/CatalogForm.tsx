/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create catalog app modal form (New World tokens; desktop portal z-index preserved).
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
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../context/DesktopWindowPortalStackContext';
import type {
	AccessGroupResponse,
	CatalogAppCreate,
} from '../services/desktopAdminApi';
import { createCatalogApp } from '../services/desktopAdminApi';
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

export function CatalogForm({
	groups,
	onClose,
	onSuccess,
}: {
	groups: AccessGroupResponse[];
	onClose: () => void;
	onSuccess: () => void;
}): React.ReactElement {
	const { t } = useTranslation('appStore');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [form, setForm] = useState<CatalogAppCreate>({
		app_id: '',
		name: '',
		description: null,
		app_component: '',
		category: 'productivity',
		sort_order: 0,
		allow_multiple_windows: false,
		max_window_instances: 1,
		is_system: false,
		is_factory: false,
		is_featured_new: false,
		maintenance_mode: false,
		ew_monthly_price: 0,
		trial_duration_days: 0,
		icon_url: null,
		icon_url_2x: null,
		preview_url: null,
		preview_url_2x: null,
		access_group_ids: [],
	});
	const createMut = useMutation({
		mutationFn: createCatalogApp,
		onSuccess: () => {
			toast.success(t('admin.toast.catalog'), t('admin.toast.added'));
			onSuccess();
		},
		onError: (err: Error) => toast.error(t('admin.toast.catalog'), err.message),
	});
	const fid = useId();
	const catalogAppId = `${fid}-app-id`;
	const catalogName = `${fid}-name`;
	const catalogAppComponent = `${fid}-app-component`;
	const catalogCategory = `${fid}-category`;
	const catalogEwMonthly = `${fid}-ew-monthly`;
	const catalogTrialDays = `${fid}-trial-days`;
	const catalogAllowMultiWindows = `${fid}-allow-multi-windows`;
	const catalogMaxWindowInstances = `${fid}-max-window-instances`;
	const catalogIconUrl = `${fid}-icon-url`;
	const catalogIconUrl2x = `${fid}-icon-url-2x`;
	const catalogPreviewUrl = `${fid}-preview-url`;
	const catalogPreviewUrl2x = `${fid}-preview-url-2x`;
	const submitErrId = `${fid}-catalog-create-error`;
	const submitMessage =
		createMut.isError && createMut.error instanceof Error
			? createMut.error.message
			: null;
	const fieldInvalid = Boolean(submitMessage);

	const touchForm = useCallback(
		(next: (prev: CatalogAppCreate) => CatalogAppCreate) => {
			createMut.reset();
			setForm(next);
		},
		[createMut]
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
					{t('admin.catalog.createTitle')}
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
							htmlFor={catalogAppId}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							app_id
						</label>
						<input
							id={catalogAppId}
							type="text"
							value={form.app_id}
							onChange={(e) =>
								touchForm((p) => ({ ...p, app_id: e.target.value }))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<label
							htmlFor={catalogName}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.common.name')}
						</label>
						<input
							id={catalogName}
							type="text"
							value={form.name}
							onChange={(e) =>
								touchForm((p) => ({ ...p, name: e.target.value }))
							}
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<label
							htmlFor={catalogAppComponent}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							app_component
						</label>
						<input
							id={catalogAppComponent}
							type="text"
							value={form.app_component}
							onChange={(e) =>
								touchForm((p) => ({ ...p, app_component: e.target.value }))
							}
							list="desktop-app-component-options"
							className={adminUiFieldClass}
							aria-describedby={fieldInvalid ? submitErrId : undefined}
						/>
						<AppComponentDatalist />
						<p className="text-xs text-(--desktop-text-dim)">
							{t('admin.form.appComponentHint')}
						</p>
						<label
							htmlFor={catalogCategory}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.common.category')}
						</label>
						<AdminSelect
							id={catalogCategory}
							value={form.category}
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
								checked={form.is_system}
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
								id={catalogAllowMultiWindows}
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
							htmlFor={catalogMaxWindowInstances}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.maxWindowInstances')}
						</label>
						<input
							id={catalogMaxWindowInstances}
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
							htmlFor={catalogEwMonthly}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.ewMonthlyPriceCreate')}
						</label>
						<input
							id={catalogEwMonthly}
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
							htmlFor={catalogTrialDays}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.trialDaysCreate')}
						</label>
						<input
							id={catalogTrialDays}
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
							{t('admin.form.storefrontUrlsHint')}
						</p>
						<label
							htmlFor={catalogIconUrl}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.iconUrl1x')}
						</label>
						<input
							id={catalogIconUrl}
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
							htmlFor={catalogIconUrl2x}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.iconUrl2x')}
						</label>
						<input
							id={catalogIconUrl2x}
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
							htmlFor={catalogPreviewUrl}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.previewUrl')}
						</label>
						<input
							id={catalogPreviewUrl}
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
							htmlFor={catalogPreviewUrl2x}
							className="block text-sm text-(--desktop-text-muted) antialiased"
						>
							{t('admin.form.previewUrl2x')}
						</label>
						<input
							id={catalogPreviewUrl2x}
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
							aria-labelledby={`${fid}-access-groups-label`}
							aria-describedby={
								fieldInvalid ? submitErrId : `${fid}-access-groups-hint`
							}
						>
							<span
								id={`${fid}-access-groups-label`}
								className="block text-sm text-(--desktop-text-muted) antialiased"
							>
								{t('admin.catalog.colGroups')}
							</span>
							<p
								id={`${fid}-access-groups-hint`}
								className="text-xs text-(--desktop-text-dim)"
							>
								{t('admin.form.accessGroupsHintCreate')}
							</p>
							<div className="max-h-40 overflow-y-auto rounded-lg border border-(--desktop-border-subtle) p-2 space-y-2">
								{groups.map((g) => (
									<label
										key={g.id}
										className="flex items-center gap-2 text-sm cursor-pointer"
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
							name={form.name}
							category={form.category ?? 'productivity'}
							description={form.description}
							iconUrl={form.icon_url}
							iconUrl2x={form.icon_url_2x}
							previewUrl={form.preview_url}
							previewUrl2x={form.preview_url_2x}
							gradient={form.gradient}
						/>
					</div>
				</div>
				<div className="mt-6 flex gap-2">
					<AdminButton
						type="button"
						variant="primary"
						onClick={() => createMut.mutate(form)}
						disabled={
							!form.app_id ||
							!form.name ||
							!form.app_component ||
							createMut.isPending
						}
					>
						{createMut.isPending
							? t('admin.common.saving')
							: t('admin.common.create')}
					</AdminButton>
					<AdminButton type="button" variant="ghost" onClick={onClose}>
						{t('admin.common.cancel')}
					</AdminButton>
				</div>
			</div>
		</div>
	);
}
