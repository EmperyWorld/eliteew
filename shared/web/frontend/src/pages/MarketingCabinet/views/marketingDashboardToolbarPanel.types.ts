import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type * as React from 'react';
import type {
	MarketingDashboardLayout,
	MarketingDashboardPreset,
	MarketingDashboardPresetListResponse,
	MarketingDashboardUsageStats,
} from '../marketingCabinetApi';

export type MarketingDashboardToolbarLayoutTemplateRow = {
	id: string;
	name?: string | null;
};

/** Портал, размеры, статус сохранения макета, выход к карточкам обзора. */
export type MarketingDashboardToolbarShellProps = {
	toolbarRegionRef: React.RefObject<HTMLDivElement | null>;
	importLayoutInputRef: React.RefObject<HTMLInputElement | null>;
	dashboardToolbarMountNode: HTMLElement | null;
	dashboardToolbarExpanded: boolean;
	setDashboardToolbarExpanded: (v: boolean) => void;
	dashboardToolbarInHeader: boolean;
	layoutSaveStatusPillRow: React.ReactNode;
	onExitToOverviewCards?: (() => void) | null;
	toolbarBusy: boolean;
	toolbarAwaitingPresets: boolean;
	allowMarketingWrite: boolean;
	dashboardToolbarLayoutGroupLabelId: string;
	dashboardToolbarWidgetsGroupLabelId: string;
	dashboardToolbarServiceGroupLabelId: string;
	mcShellPanel: string;
};

/** Пресеты и быстрый выбор категории/поиска. */
export type MarketingDashboardToolbarPresetsProps = {
	presetCategorySelectId: string;
	presetSearchInputId: string;
	presetSelectId: string;
	presetHintId: string;
	presetCategoryFilter: string;
	setPresetCategoryFilter: (v: string) => void;
	presetCategories: string[];
	presetSearchQuery: string;
	setPresetSearchQuery: (v: string) => void;
	presetSelectValue: string;
	setPresetSelectValue: (v: string) => void;
	presetsFromApi: MarketingDashboardPreset[];
	presetSelectOptions: { value: string; label: string }[];
	presets: MarketingDashboardPreset[];
	filteredPresets: MarketingDashboardPreset[];
	recentPresetQuickList: MarketingDashboardPreset[];
	projectId: string;
	setPresetApplyDialog: (v: { name: string; label: string }) => void;
	rebuildPresetFromTemplateMutation: UseMutationResult<unknown, Error, string>;
	applyPresetMutation: UseMutationResult<unknown, Error, string>;
};

/** Шаблоны макетов и активный layout. */
export type MarketingDashboardToolbarTemplatesProps = {
	layoutTemplateSelectId: string;
	layoutTemplatesCaveatId: string;
	layoutTemplatesQuery: UseQueryResult<unknown>;
	selectedLayoutTemplateId: string;
	setSelectedLayoutTemplateId: (v: string) => void;
	layoutTemplateSelectOptions: { value: string; label: string }[];
	layoutTemplateRows: MarketingDashboardToolbarLayoutTemplateRow[];
	applyLayoutTemplateMutation: UseMutationResult<unknown, Error, string>;
	deleteLayoutTemplateMutation: UseMutationResult<unknown, Error, string>;
	activeLayoutQuery: UseQueryResult<
		MarketingDashboardLayout | null | undefined
	>;
	setSaveTemplateOpen: (v: boolean) => void;
	setSaveTemplateName: (v: string) => void;
	setSaveTemplateDescription: (v: string) => void;
	handleCreateBlankLayout: () => void;
	presetsQuery: UseQueryResult<MarketingDashboardPresetListResponse>;
};

/** Добавление виджетов и лимиты. */
export type MarketingDashboardToolbarWidgetsProps = {
	addWidgetSelectId: string;
	addWidgetSelectValue: string;
	setAddWidgetSelectValue: (v: string) => void;
	addWidgetSelectOptions: { value: string; label: string }[];
	handleAddWidget: (key: string) => void;
	atWidgetCap: boolean;
	widgetLayoutCap: number;
	usageStatsQuery: UseQueryResult<MarketingDashboardUsageStats>;
};

/** Undo/redo сетки, справка, импорт/экспорт, очистка дублей. */
export type MarketingDashboardToolbarOpsProps = {
	canUndoGridLayout: boolean;
	canRedoGridLayout: boolean;
	undoGridLayout: () => void;
	redoGridLayout: () => void;
	setShortcutsOpen: (v: boolean) => void;
	handleExportLayoutJson: () => void;
	handleImportLayoutFileList: (files: FileList | null) => void;
	handlePasteWidgetFromClipboard: () => void | Promise<void>;
	cleanupDuplicatesMutation: UseMutationResult<unknown, Error, void>;
	t: (key: string, options?: Record<string, unknown>) => string;
};

/** Сгруппированный контракт тулбара (портал остаётся в Overview). */
export type MarketingDashboardToolbarPanelProps =
	MarketingDashboardToolbarShellProps &
		MarketingDashboardToolbarPresetsProps &
		MarketingDashboardToolbarTemplatesProps &
		MarketingDashboardToolbarWidgetsProps &
		MarketingDashboardToolbarOpsProps;
