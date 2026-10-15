/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin Doc Editor plugins catalog (Wave 2) — list/enable/disable/create via New World UI.
 *
 * Invariants:
 * - Uses existing adminApi doc-editor clients; no Old World chrome.
 * - Disable is soft (DELETE admin route); enable via POST …/enable.
 *
 * Related:
 * - services/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	adminApi,
	type DocEditorAdminPlugin,
	type DocEditorAdminPluginUpsertPayload,
} from '../../../services/admin/api';
import {
	AdminButton,
	AdminDataTable,
	AdminDrawer,
	AdminField,
	AdminStatusBanner,
	AdminToggle,
	DangerConfirmModal,
	EntityLifecycleBar,
	type AdminDataTableColumn,
} from '../ui';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';

function emptyCreate(): DocEditorAdminPluginUpsertPayload {
	return {
		name: '',
		description: '',
		version: '1.0.0',
		author: '',
		category: 'general',
		rating: 0,
		downloads: 0,
		tags: [],
		icon: 'plugin',
		permissions: [],
		is_official: false,
		is_gpu_accelerated: false,
		price: null,
		is_enabled: true,
		sort_order: 0,
	};
}

export function DocEditorPluginsAdminSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const meta = getAdminShellSectionMeta('docEditor');
	const [plugins, setPlugins] = React.useState<DocEditorAdminPlugin[]>([]);
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [createOpen, setCreateOpen] = React.useState(false);
	const [draft, setDraft] = React.useState(emptyCreate);
	const [disableId, setDisableId] = React.useState<string | null>(null);

	const refresh = React.useCallback(async () => {
		setError(null);
		try {
			setPlugins(await adminApi.listDocEditorPlugins());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const columns = React.useMemo<AdminDataTableColumn<DocEditorAdminPlugin>[]>(
		() => [
			{
				id: 'name',
				header: t('adminDocEditor.colName', 'Name'),
				cell: (row) => row.name,
			},
			{
				id: 'version',
				header: t('adminDocEditor.colVersion', 'Version'),
				cell: (row) => row.version,
			},
			{
				id: 'enabled',
				header: t('adminDocEditor.colEnabled', 'Enabled'),
				cell: (row) => (row.isEnabled ? 'yes' : 'no'),
			},
			{
				id: 'actions',
				header: t('adminDocEditor.colActions', 'Actions'),
				cell: (row) => (
					<EntityLifecycleBar
						deleteLabel={t('adminDocEditor.disable', 'Disable')}
						onDelete={() => setDisableId(row.id)}
						deleteDisabled={busy || !row.isEnabled}
					>
						{!row.isEnabled ? (
							<AdminButton
								variant="secondary"
								disabled={busy}
								onClick={() =>
									void (async () => {
										setBusy(true);
										try {
											await adminApi.enableDocEditorPlugin(row.id);
											await refresh();
										} catch (err) {
											setError(
												err instanceof Error ? err.message : String(err)
											);
										} finally {
											setBusy(false);
										}
									})()
								}
							>
								{t('adminDocEditor.enable', 'Enable')}
							</AdminButton>
						) : null}
					</EntityLifecycleBar>
				),
			},
		],
		[busy, refresh, t]
	);

	return (
		<AdminSectionFrame variant="full">
			<p className="sr-only">{meta.description}</p>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-[var(--admin-ui-fg-muted)]">
					{t(
						'adminDocEditor.subtitle',
						'Catalog plugins for the document editor marketplace.'
					)}
				</p>
				<div className="flex gap-2">
					<AdminButton
						variant="ghost"
						disabled={busy}
						onClick={() => void refresh()}
					>
						{t('adminDocEditor.refresh', 'Refresh')}
					</AdminButton>
					<AdminButton
						variant="primary"
						disabled={busy}
						onClick={() => {
							setDraft(emptyCreate());
							setCreateOpen(true);
						}}
					>
						{t('adminDocEditor.create', 'Create plugin')}
					</AdminButton>
				</div>
			</div>

			{error ? <AdminStatusBanner tone="danger" title={error} /> : null}

			<AdminDataTable
				columns={columns}
				rows={plugins}
				rowKey={(row) => row.id}
				empty={
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('adminDocEditor.empty', 'No plugins yet.')}
					</p>
				}
			/>

			<AdminDrawer
				open={createOpen}
				title={t('adminDocEditor.createTitle', 'Create plugin')}
				onClose={() => setCreateOpen(false)}
				footer={
					<>
						<AdminButton variant="ghost" onClick={() => setCreateOpen(false)}>
							{t('adminDocEditor.cancel', 'Cancel')}
						</AdminButton>
						<AdminButton
							variant="primary"
							disabled={busy || !draft.name.trim()}
							onClick={() =>
								void (async () => {
									setBusy(true);
									setError(null);
									try {
										await adminApi.createDocEditorPlugin({
											...draft,
											name: draft.name.trim(),
										});
										setCreateOpen(false);
										await refresh();
									} catch (err) {
										setError(err instanceof Error ? err.message : String(err));
									} finally {
										setBusy(false);
									}
								})()
							}
						>
							{t('adminDocEditor.save', 'Save')}
						</AdminButton>
					</>
				}
			>
				<div className="space-y-3">
					<AdminField
						aria-label="name"
						placeholder="Name"
						value={draft.name}
						onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
					/>
					<AdminField
						aria-label="description"
						placeholder="Description"
						value={draft.description}
						onChange={(e) =>
							setDraft((d) => ({ ...d, description: e.target.value }))
						}
					/>
					<AdminField
						aria-label="version"
						placeholder="Version"
						value={draft.version}
						onChange={(e) =>
							setDraft((d) => ({ ...d, version: e.target.value }))
						}
					/>
					<AdminField
						aria-label="author"
						placeholder="Author"
						value={draft.author}
						onChange={(e) =>
							setDraft((d) => ({ ...d, author: e.target.value }))
						}
					/>
					<AdminToggle
						label={t('adminDocEditor.enabled', 'Enabled')}
						checked={draft.is_enabled}
						onChange={(e) =>
							setDraft((d) => ({ ...d, is_enabled: e.target.checked }))
						}
					/>
				</div>
			</AdminDrawer>

			<DangerConfirmModal
				open={Boolean(disableId)}
				title={t('adminDocEditor.disableTitle', 'Disable plugin')}
				confirmPhrase="DISABLE"
				busy={busy}
				onCancel={() => setDisableId(null)}
				onConfirm={() =>
					void (async () => {
						if (!disableId) return;
						setBusy(true);
						try {
							await adminApi.disableDocEditorPlugin(disableId);
							setDisableId(null);
							await refresh();
						} catch (err) {
							setError(err instanceof Error ? err.message : String(err));
						} finally {
							setBusy(false);
						}
					})()
				}
			/>
		</AdminSectionFrame>
	);
}
