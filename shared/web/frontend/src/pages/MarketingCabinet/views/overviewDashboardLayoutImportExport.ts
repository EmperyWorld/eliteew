import type { MarketingDashboardLayout } from '../marketingCabinetApi';

import { cabinetNotify } from '../cabinetNotify';

/** Экспорт активного макета в JSON (схема `_exportSchemaVersion`). */
export function exportMarketingDashboardLayoutJson(options: {
	layoutData: MarketingDashboardLayout;
	projectId: string;
	schemaVersion: number;
	t: (key: string) => string;
}): void {
	const { layoutData, projectId, schemaVersion, t } = options;
	const payload = {
		_exportSchemaVersion: schemaVersion,
		exportedAt: new Date().toISOString(),
		layout: layoutData,
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `marketing-dashboard-layout-${projectId.slice(0, 8)}.json`;
	a.click();
	URL.revokeObjectURL(url);
	cabinetNotify.success(t('overview.dashboard.toolbar.exportLayoutDone'));
}

/**
 * Импорт макета из первого файла списка; валидация схемы и капа по числу виджетов до вызова мутации.
 */
export async function importMarketingDashboardLayoutFromFileList(
	files: FileList | null,
	options: {
		allowMarketingWrite: boolean;
		schemaVersion: number;
		maxWidgetsPerLayout: number;
		importLayoutMutateAsync: (
			payload: Record<string, unknown>
		) => Promise<unknown>;
		clearImportInput: () => void;
		t: (key: string, options?: Record<string, unknown>) => string;
	}
): Promise<void> {
	const {
		allowMarketingWrite,
		schemaVersion,
		maxWidgetsPerLayout,
		importLayoutMutateAsync,
		clearImportInput,
		t,
	} = options;

	if (!files?.length || !allowMarketingWrite) {
		return;
	}
	const file = files[0];
	let parsed: unknown;
	try {
		parsed = JSON.parse(await file.text());
	} catch {
		cabinetNotify.error(t('overview.dashboard.toolbar.importLayoutInvalid'));
		return;
	}
	if (!parsed || typeof parsed !== 'object') {
		cabinetNotify.error(t('overview.dashboard.toolbar.importLayoutInvalid'));
		return;
	}
	const root = parsed as Record<string, unknown>;
	if (root._exportSchemaVersion !== schemaVersion) {
		cabinetNotify.error(t('overview.dashboard.toolbar.importLayoutInvalid'));
		return;
	}
	const innerLayout = root.layout;
	if (!innerLayout || typeof innerLayout !== 'object') {
		cabinetNotify.error(t('overview.dashboard.toolbar.importLayoutInvalid'));
		return;
	}
	const widgets = (innerLayout as { widgets?: unknown }).widgets;
	if (!Array.isArray(widgets) || widgets.length < 1) {
		cabinetNotify.error(t('overview.dashboard.toolbar.importLayoutInvalid'));
		return;
	}
	if (widgets.length > maxWidgetsPerLayout) {
		cabinetNotify.error(
			t('overview.dashboard.toolbar.importLayoutTooMany', {
				cap: maxWidgetsPerLayout,
				current: 0,
				adding: widgets.length,
			})
		);
		return;
	}
	try {
		await importLayoutMutateAsync(root);
	} finally {
		clearImportInput();
	}
}
