import { useMutation, type QueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { TFunction } from 'i18next';

import { cabinetNotify } from '../cabinetNotify';
import {
	marketingCabinetApi,
	type MarketingDashboardLayout,
	type MarketingDashboardWidget,
} from '../marketingCabinetApi';
import {
	marketingCabinetDashboardLayoutInvalidationQueryKey,
	marketingCabinetDashboardLayoutQueryKey,
	marketingCabinetDashboardLayoutTemplatesInvalidationQueryKey,
	marketingCabinetDashboardUsageStatsInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';
import { pushDashboardPresetHistory } from '../dashboard-widgets/dashboardPresetHistory';
import { isWidgetConfigOnlyPatch } from '../views/overviewInteractiveDashboardHelpers';

type MarketingPresetRow = {
	name: string;
	display_name?: string;
};

export function useMarketingDashboardOverviewMutations({
	projectId,
	queryClient,
	presetsFromApi,
	t,
	extractApiErrorMessage,
	setPresetAnnouncement,
	setPresetAnnouncementTick,
	setLayoutAnnouncement,
	setLayoutAnnouncementTick,
	setSaveTemplateOpen,
	setSaveTemplateName,
	setSaveTemplateDescription,
	setSelectedLayoutTemplateId,
}: {
	projectId: string;
	queryClient: QueryClient;
	presetsFromApi: readonly MarketingPresetRow[];
	t: TFunction<'marketing'>;
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
	setPresetAnnouncement: React.Dispatch<React.SetStateAction<string>>;
	setPresetAnnouncementTick: React.Dispatch<React.SetStateAction<number>>;
	setLayoutAnnouncement: React.Dispatch<React.SetStateAction<string>>;
	setLayoutAnnouncementTick: React.Dispatch<React.SetStateAction<number>>;
	setSaveTemplateOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setSaveTemplateName: React.Dispatch<React.SetStateAction<string>>;
	setSaveTemplateDescription: React.Dispatch<React.SetStateAction<string>>;
	setSelectedLayoutTemplateId: React.Dispatch<React.SetStateAction<string>>;
}) {
	const pendingScrollWidgetIdRef = React.useRef<string | null>(null);

	const activeLayoutQueryKey = React.useMemo(
		() => marketingCabinetDashboardLayoutQueryKey(projectId),
		[projectId]
	);

	const bootstrapMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createDashboardLayoutFromPreset(projectId, {
				preset_name: 'minimal',
			}),
		onSuccess: async () => {
			const presetMeta = presetsFromApi.find((p) => p.name === 'minimal');
			const label = presetMeta?.display_name ?? 'minimal';
			setPresetAnnouncement(
				t('overview.dashboard.toolbar.presetAppliedLive', { name: label })
			);
			setPresetAnnouncementTick((n) => n + 1);
			pushDashboardPresetHistory(projectId, 'minimal');
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
	});

	const applyPresetMutation = useMutation({
		mutationFn: (presetName: string) =>
			marketingCabinetApi.createDashboardLayoutFromPreset(projectId, {
				preset_name: presetName,
			}),
		onSuccess: async (_data, presetName) => {
			pushDashboardPresetHistory(projectId, presetName);
			const presetMeta = presetsFromApi.find((p) => p.name === presetName);
			const label = presetMeta?.display_name ?? presetName;
			setPresetAnnouncement(
				t('overview.dashboard.toolbar.presetAppliedLive', { name: label })
			);
			setPresetAnnouncementTick((n) => n + 1);
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
	});

	const rebuildPresetFromTemplateMutation = useMutation({
		mutationFn: (presetName: string) =>
			marketingCabinetApi.createDashboardLayoutFromPreset(projectId, {
				preset_name: presetName,
				rebuild_existing: true,
			}),
		onSuccess: async (_data, presetName) => {
			pushDashboardPresetHistory(projectId, presetName);
			const presetMeta = presetsFromApi.find((p) => p.name === presetName);
			const label = presetMeta?.display_name ?? presetName;
			cabinetNotify.success(
				t('overview.dashboard.toolbar.rebuildPresetFromTemplateDone', {
					name: label,
				})
			);
			setPresetAnnouncement(
				t('overview.dashboard.toolbar.presetRebuildLive', { name: label })
			);
			setPresetAnnouncementTick((n) => n + 1);
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.rebuildPresetFromTemplateFailed')
				)
			);
		},
	});

	const importLayoutMutation = useMutation({
		mutationFn: (payload: Record<string, unknown>) =>
			marketingCabinetApi.importDashboardLayoutFromExport(projectId, payload),
		onSuccess: async (_data, variables) => {
			const layout = variables.layout as { widgets?: unknown[] } | undefined;
			const count = Array.isArray(layout?.widgets) ? layout.widgets.length : 0;
			cabinetNotify.success(
				t('overview.dashboard.toolbar.importLayoutDone', { count })
			);
			setLayoutAnnouncement(
				t('overview.dashboard.toolbar.layoutImportLive', { count })
			);
			setLayoutAnnouncementTick((n) => n + 1);
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.importLayoutFailed')
				)
			);
		},
	});

	const saveLayoutTemplateMutation = useMutation({
		mutationFn: (body: { name: string; description?: string | null }) =>
			marketingCabinetApi.saveDashboardLayoutAsTemplate(projectId, body),
		onSuccess: async () => {
			cabinetNotify.success(
				t('overview.dashboard.toolbar.saveLayoutTemplateDone')
			);
			setSaveTemplateOpen(false);
			setSaveTemplateName('');
			setSaveTemplateDescription('');
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutTemplatesInvalidationQueryKey(),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.saveLayoutTemplateFailed')
				)
			);
		},
	});

	const applyLayoutTemplateMutation = useMutation({
		mutationFn: (templateId: string) =>
			marketingCabinetApi.applyDashboardLayoutTemplate(projectId, {
				template_layout_id: templateId,
			}),
		onSuccess: async (layout) => {
			const count = layout.widgets?.length ?? 0;
			cabinetNotify.success(
				t('overview.dashboard.toolbar.applySavedLayoutDone', { count })
			);
			setLayoutAnnouncement(
				t('overview.dashboard.toolbar.layoutImportLive', { count })
			);
			setLayoutAnnouncementTick((n) => n + 1);
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardUsageStatsInvalidationQueryKey(projectId),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.applySavedLayoutFailed')
				)
			);
		},
	});

	const deleteLayoutTemplateMutation = useMutation({
		mutationFn: (templateId: string) =>
			marketingCabinetApi.deleteDashboardLayoutTemplate(templateId),
		onSuccess: async () => {
			cabinetNotify.success(
				t('overview.dashboard.toolbar.deleteSavedLayoutDone')
			);
			setSelectedLayoutTemplateId('');
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutTemplatesInvalidationQueryKey(),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.deleteSavedLayoutFailed')
				)
			);
		},
	});

	const addWidgetMutation = useMutation({
		mutationFn: (
			body: Parameters<typeof marketingCabinetApi.addDashboardWidget>[1]
		) => marketingCabinetApi.addDashboardWidget(projectId, body),
		onMutate: async (body) => {
			await queryClient.cancelQueries({ queryKey: activeLayoutQueryKey });
			const previous =
				queryClient.getQueryData<MarketingDashboardLayout>(
					activeLayoutQueryKey
				);
			if (!previous?.id || previous.id !== body.layout_id) {
				return { previous };
			}
			const tempId = `optimistic-${crypto.randomUUID()}`;
			const now = new Date().toISOString();
			const optimisticWidget: MarketingDashboardWidget = {
				id: tempId,
				layout_id: previous.id,
				widget_key: body.widget_key,
				widget_title: body.widget_title,
				widget_config: body.widget_config ?? {},
				grid_position: {
					x: body.grid_position?.x ?? 0,
					y: body.grid_position?.y ?? 0,
					w: body.grid_position?.w ?? 1,
					h: body.grid_position?.h ?? 1,
					minW: body.grid_position?.minW,
					minH: body.grid_position?.minH,
					maxW: body.grid_position?.maxW,
					maxH: body.grid_position?.maxH,
					i: body.grid_position?.i,
				},
				is_visible: body.is_visible ?? true,
				is_locked: body.is_locked ?? false,
				display_order: body.display_order ?? 0,
				created_at: now,
				updated_at: now,
			};
			queryClient.setQueryData<MarketingDashboardLayout>(activeLayoutQueryKey, {
				...previous,
				updated_at: now,
				widgets: [...(previous.widgets ?? []), optimisticWidget],
			});
			return { previous, tempId };
		},
		onError: (err, _body, ctx) => {
			if (ctx?.previous !== undefined) {
				queryClient.setQueryData(activeLayoutQueryKey, ctx.previous);
			}
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.addWidgetFailed')
				)
			);
		},
		onSuccess: async (created, _body, ctx) => {
			pendingScrollWidgetIdRef.current = created.id;
			if (ctx?.tempId) {
				queryClient.setQueryData<MarketingDashboardLayout>(
					activeLayoutQueryKey,
					(old) => {
						if (!old) return old;
						return {
							...old,
							updated_at: created.updated_at,
							widgets: (old.widgets ?? []).map((w) =>
								w.id === ctx.tempId ? created : w
							),
						};
					}
				);
			}
			await queryClient.invalidateQueries({ queryKey: activeLayoutQueryKey });
		},
	});

	const patchWidgetMutation = useMutation({
		mutationFn: ({
			widgetId,
			body,
		}: {
			widgetId: string;
			body: Parameters<typeof marketingCabinetApi.updateDashboardWidget>[2];
		}) => marketingCabinetApi.updateDashboardWidget(projectId, widgetId, body),
		onMutate: async (variables) => {
			const { widgetId, body } = variables;
			if (!isWidgetConfigOnlyPatch(body) || body.widget_config === undefined) {
				return undefined;
			}
			await queryClient.cancelQueries({ queryKey: activeLayoutQueryKey });
			const previous =
				queryClient.getQueryData<MarketingDashboardLayout>(
					activeLayoutQueryKey
				);
			if (!previous) {
				return undefined;
			}
			const now = new Date().toISOString();
			queryClient.setQueryData<MarketingDashboardLayout>(activeLayoutQueryKey, {
				...previous,
				updated_at: now,
				widgets: (previous.widgets ?? []).map((w) =>
					w.id === widgetId
						? {
								...w,
								widget_config: body.widget_config ?? {},
								updated_at: now,
							}
						: w
				),
			});
			return { previous };
		},
		onError: (_err, _variables, ctx) => {
			if (ctx?.previous !== undefined) {
				queryClient.setQueryData(activeLayoutQueryKey, ctx.previous);
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
	});

	const deleteWidgetMutation = useMutation({
		mutationFn: (widgetId: string) =>
			marketingCabinetApi.deleteDashboardWidget(projectId, widgetId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
	});

	const cleanupDuplicatesMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.cleanupDashboardDuplicateWidgets(projectId),
		onSuccess: async (res) => {
			cabinetNotify.success(
				t('overview.dashboard.toolbar.cleanupDuplicatesDone', {
					count: res.deleted_count,
				})
			);
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.cleanupDuplicatesFailed')
				)
			);
		},
	});

	const createBlankLayoutMutation = useMutation({
		mutationFn: () => {
			const name = `${t('overview.dashboard.toolbar.blankLayoutBaseName')} · ${crypto.randomUUID().slice(0, 8)}`;
			return marketingCabinetApi.createDashboardLayout(projectId, {
				name,
				type: 'custom',
				is_active: true,
			});
		},
		onSuccess: async () => {
			cabinetNotify.success(t('overview.dashboard.toolbar.blankLayoutCreated'));
			await queryClient.invalidateQueries({
				queryKey:
					marketingCabinetDashboardLayoutInvalidationQueryKey(projectId),
			});
		},
		onError: (err) => {
			cabinetNotify.error(
				extractApiErrorMessage(
					err,
					t('overview.dashboard.toolbar.blankLayoutFailed')
				)
			);
		},
	});

	return {
		pendingScrollWidgetIdRef,
		bootstrapMutation,
		applyPresetMutation,
		rebuildPresetFromTemplateMutation,
		importLayoutMutation,
		saveLayoutTemplateMutation,
		applyLayoutTemplateMutation,
		deleteLayoutTemplateMutation,
		addWidgetMutation,
		patchWidgetMutation,
		deleteWidgetMutation,
		cleanupDuplicatesMutation,
		createBlankLayoutMutation,
	};
}
