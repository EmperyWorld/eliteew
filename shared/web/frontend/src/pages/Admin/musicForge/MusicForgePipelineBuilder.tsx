/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Pipeline Architect: Modes with user-facing display names + ordered stage graph.
 *
 * Invariants:
 * - Mutations only when isDraft; stage_type from closed catalog only.
 * - stage_type is read-only on existing rows (delete + add to change type).
 * - label_ru / label_en are what users see in Song Studio Mode picker.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/musicForgeAdminApi.ts`
 * - `pages/Admin/musicForge/musicForgePipelineBuilderModel.ts`
 * - `documentation/product/MUSIC-FORGE-APP.md`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import { AdminButton } from '../ui';
import {
	type MusicForgeStageTypesResponse,
	createMusicForgeAdminConfigMode,
	createMusicForgeAdminConfigStage,
	deleteMusicForgeAdminConfigMode,
	deleteMusicForgeAdminConfigStage,
	getMusicForgeAdminStageTypes,
	patchMusicForgeAdminConfigMode,
	patchMusicForgeAdminConfigStage,
} from './musicForgeAdminApi';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import {
	modeListLabel,
	parseModes,
	parseStages,
} from './musicForgePipelineBuilderModel';
import { MusicForgePipelineBuilderModeForm } from './MusicForgePipelineBuilderModeForm';
import { MusicForgePipelineBuilderModeEditor } from './MusicForgePipelineBuilderModeEditor';
import { MusicForgePipelineBuilderStagePanel } from './MusicForgePipelineBuilderStagePanel';

const panelClass =
	'rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4';

export interface MusicForgePipelineBuilderProps {
	revisionId: string;
	isDraft: boolean;
	modes: Record<string, unknown>;
	pipelines: Record<string, unknown>;
	laneKeys: string[];
	onChanged: () => Promise<void>;
	onError: (message: string) => void;
	onMessage: (message: string) => void;
}

export function MusicForgePipelineBuilder({
	revisionId,
	isDraft,
	modes: modesRaw,
	pipelines: pipelinesRaw,
	laneKeys,
	onChanged,
	onError,
	onMessage,
}: MusicForgePipelineBuilderProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const modes = React.useMemo(() => parseModes(modesRaw), [modesRaw]);
	const [modeKey, setModeKey] = React.useState('');
	const [catalog, setCatalog] =
		React.useState<MusicForgeStageTypesResponse | null>(null);
	const [saving, setSaving] = React.useState(false);
	const [addType, setAddType] = React.useState('llm_generate');
	const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);

	const [labelRu, setLabelRu] = React.useState('');
	const [labelEn, setLabelEn] = React.useState('');
	const [laneKey, setLaneKey] = React.useState('');
	const [enabled, setEnabled] = React.useState(true);
	const [isDefault, setIsDefault] = React.useState(false);
	const [showCreateMode, setShowCreateMode] = React.useState(false);
	const [newModeKey, setNewModeKey] = React.useState('');
	const [newLabelRu, setNewLabelRu] = React.useState('');
	const [newLabelEn, setNewLabelEn] = React.useState('');
	const [newLaneKey, setNewLaneKey] = React.useState('');

	const [stageKey, setStageKey] = React.useState('');
	const [titleRu, setTitleRu] = React.useState('');
	const [stageEnabled, setStageEnabled] = React.useState(true);
	const [sortOrder, setSortOrder] = React.useState('0');
	const [settingsJson, setSettingsJson] = React.useState('{}');

	React.useEffect(() => {
		if (!modeKey && modes[0]) setModeKey(modes[0].mode_key);
	}, [modes, modeKey]);

	React.useEffect(() => {
		const mode = modes.find((m) => m.mode_key === modeKey);
		if (!mode) return;
		setLabelRu(mode.label_ru);
		setLabelEn(mode.label_en);
		setLaneKey(mode.lane_key);
		setEnabled(mode.enabled);
		setIsDefault(mode.is_default);
	}, [modes, modeKey]);

	const stages = React.useMemo(
		() => parseStages(pipelinesRaw, modeKey),
		[pipelinesRaw, modeKey]
	);

	React.useEffect(() => {
		if (!stageKey && stages[0]) setStageKey(stages[0].stage_key);
		if (
			stageKey &&
			!stages.some((s) => s.stage_key === stageKey) &&
			stages[0]
		) {
			setStageKey(stages[0].stage_key);
		}
	}, [stages, stageKey]);

	React.useEffect(() => {
		const stage = stages.find((s) => s.stage_key === stageKey);
		if (!stage) return;
		setTitleRu(stage.title_ru);
		setStageEnabled(stage.enabled);
		setSortOrder(String(stage.sort_order));
		setSettingsJson(JSON.stringify(stage.settings ?? {}, null, 2));
		setShowAdvancedSettings(false);
	}, [stages, stageKey]);

	React.useEffect(() => {
		void getMusicForgeAdminStageTypes()
			.then(setCatalog)
			.catch((err: unknown) => {
				log.error(
					'MusicForgePipelineBuilder',
					'stage types load failed',
					err instanceof Error ? err : undefined
				);
			});
	}, []);

	React.useEffect(() => {
		if (!newLaneKey && laneKeys[0]) {
			setNewLaneKey(laneKeys[0]);
		}
	}, [laneKeys, newLaneKey]);

	const saveMode = async () => {
		if (!isDraft || !modeKey) return;
		setSaving(true);
		try {
			await patchMusicForgeAdminConfigMode(revisionId, modeKey, {
				label_ru: labelRu.trim(),
				label_en: labelEn.trim(),
				lane_key: laneKey,
				enabled,
				is_default: isDefault,
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			log.error(
				'MusicForgePipelineBuilder',
				'mode save failed',
				err instanceof Error ? err : undefined
			);
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const addMode = async () => {
		if (!isDraft) return;
		const modeKeyValue = newModeKey.trim();
		const labelRuValue = newLabelRu.trim();
		const labelEnValue = newLabelEn.trim();
		if (!modeKeyValue || !labelRuValue || !labelEnValue || !newLaneKey) {
			onError(t('adminMusicForge.pipelineCreateModeRequired'));
			return;
		}
		setSaving(true);
		try {
			const created = await createMusicForgeAdminConfigMode(revisionId, {
				mode_key: modeKeyValue,
				label_ru: labelRuValue,
				label_en: labelEnValue,
				lane_key: newLaneKey,
			});
			setModeKey(created.mode_key);
			setShowCreateMode(false);
			setNewModeKey('');
			setNewLabelRu('');
			setNewLabelEn('');
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const removeMode = async () => {
		if (!isDraft || !modeKey || modes.length <= 1) return;
		if (
			!window.confirm(
				t('adminMusicForge.pipelineDeleteModeConfirm', { mode: modeKey })
			)
		) {
			return;
		}
		setSaving(true);
		try {
			await deleteMusicForgeAdminConfigMode(revisionId, modeKey);
			setModeKey('');
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const saveStage = async () => {
		if (!isDraft || !modeKey || !stageKey) return;
		setSaving(true);
		try {
			let settings: Record<string, unknown>;
			try {
				const parsed: unknown = JSON.parse(settingsJson);
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					throw new Error('settings must be object');
				}
				settings = parsed as Record<string, unknown>;
			} catch {
				onError(t('adminMusicForge.pipelineSettingsJsonInvalid'));
				setSaving(false);
				return;
			}
			await patchMusicForgeAdminConfigStage(revisionId, modeKey, stageKey, {
				title_ru: titleRu.trim(),
				enabled: stageEnabled,
				sort_order: Number(sortOrder),
				settings,
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			log.error(
				'MusicForgePipelineBuilder',
				'stage save failed',
				err instanceof Error ? err : undefined
			);
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const moveStage = async (direction: -1 | 1) => {
		if (!isDraft || !modeKey || !stageKey) return;
		const idx = stages.findIndex((s) => s.stage_key === stageKey);
		const swap = stages[idx + direction];
		if (idx < 0 || !swap) return;
		setSaving(true);
		try {
			const current = stages[idx];
			await patchMusicForgeAdminConfigStage(
				revisionId,
				modeKey,
				current.stage_key,
				{
					sort_order: swap.sort_order,
				}
			);
			await patchMusicForgeAdminConfigStage(
				revisionId,
				modeKey,
				swap.stage_key,
				{
					sort_order: current.sort_order,
				}
			);
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const addStage = async () => {
		if (!isDraft || !modeKey || !addType) return;
		setSaving(true);
		try {
			const suffix = String(Date.now()).slice(-6);
			const key = `${addType}_${suffix}`.replace(/[^a-z0-9_]/g, '_');
			const created = await createMusicForgeAdminConfigStage(
				revisionId,
				modeKey,
				{
					stage_key: key,
					stage_type: addType,
					enabled: true,
				}
			);
			setStageKey(String(created.stage_key ?? key));
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	const removeStage = async () => {
		if (!isDraft || !modeKey || !stageKey) return;
		if (
			!window.confirm(
				t('adminMusicForge.pipelineDeleteConfirm', { stage: stageKey })
			)
		) {
			return;
		}
		setSaving(true);
		try {
			await deleteMusicForgeAdminConfigStage(revisionId, modeKey, stageKey);
			setStageKey('');
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onChanged();
		} catch (err) {
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorSaveError')
			);
		} finally {
			setSaving(false);
		}
	};

	if (modes.length === 0) {
		if (!isDraft) {
			return (
				<p className={adminUiMetaClass}>
					{t('adminMusicForge.pipelineEmptyModes')}
				</p>
			);
		}
		return (
			<div className={panelClass}>
				<MusicForgePipelineBuilderModeForm
					laneKeys={laneKeys}
					modeKey={newModeKey}
					labelRu={newLabelRu}
					labelEn={newLabelEn}
					laneKey={newLaneKey}
					saving={saving}
					showIntro
					onModeKeyChange={setNewModeKey}
					onLabelRuChange={setNewLabelRu}
					onLabelEnChange={setNewLabelEn}
					onLaneKeyChange={setNewLaneKey}
					onSubmit={() => void addMode()}
				/>
			</div>
		);
	}

	const selectedStage = stages.find((s) => s.stage_key === stageKey);
	const stageTypes = catalog?.stage_types ?? [];
	const selectedMode = modes.find((m) => m.mode_key === modeKey);
	const defaultMark = t('adminMusicForge.pipelineDefaultBadge');

	return (
		<div className="space-y-4">
			<div className={panelClass}>
				<p className="text-sm font-medium text-white">
					{t('adminMusicForge.pipelineTitle')}
				</p>
				<p className={`mt-1 ${adminUiMetaClass}`}>
					{t('adminMusicForge.pipelineHint')}
				</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
				<aside className={`${panelClass} space-y-2`}>
					<p className="text-xs font-medium uppercase tracking-wide text-slate-400">
						{t('adminMusicForge.pipelineModesHeading')}
					</p>
					<ul className="space-y-1.5">
						{modes.map((m) => {
							const active = m.mode_key === modeKey;
							return (
								<li key={m.mode_key}>
									<button
										type="button"
										onClick={() => setModeKey(m.mode_key)}
										className={`w-full rounded-xl border px-3 py-2.5 text-left ${
											active
												? 'border-violet-400/40 bg-violet-600/20 text-white'
												: 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
										}`}
									>
										<span className="block text-sm font-medium">
											{modeListLabel(m, defaultMark)}
										</span>
										<span className="mt-0.5 block font-mono text-[11px] text-slate-500">
											{m.mode_key}
											{m.enabled
												? ''
												: ` · ${t('adminMusicForge.pipelineDisabled')}`}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
					{isDraft ? (
						showCreateMode ? (
							<div className="rounded-xl border border-white/10 bg-black/20 p-3">
								<MusicForgePipelineBuilderModeForm
									laneKeys={laneKeys}
									modeKey={newModeKey}
									labelRu={newLabelRu}
									labelEn={newLabelEn}
									laneKey={newLaneKey}
									saving={saving}
									onModeKeyChange={setNewModeKey}
									onLabelRuChange={setNewLabelRu}
									onLabelEnChange={setNewLabelEn}
									onLaneKeyChange={setNewLaneKey}
									onSubmit={() => void addMode()}
									onCancel={() => setShowCreateMode(false)}
								/>
							</div>
						) : (
							<AdminButton
								variant="secondary"
								disabled={saving}
								onClick={() => setShowCreateMode(true)}
							>
								{t('adminMusicForge.pipelineAddMode')}
							</AdminButton>
						)
					) : null}
				</aside>

				<div className="space-y-4">
					<MusicForgePipelineBuilderModeEditor
						isDraft={isDraft}
						saving={saving}
						modeCount={modes.length}
						selectedMode={selectedMode}
						laneKeys={laneKeys}
						labelRu={labelRu}
						labelEn={labelEn}
						laneKey={laneKey}
						enabled={enabled}
						isDefault={isDefault}
						onLabelRuChange={setLabelRu}
						onLabelEnChange={setLabelEn}
						onLaneKeyChange={setLaneKey}
						onEnabledChange={setEnabled}
						onIsDefaultChange={setIsDefault}
						onSave={() => void saveMode()}
						onDelete={() => void removeMode()}
					/>

					<MusicForgePipelineBuilderStagePanel
						isDraft={isDraft}
						saving={saving}
						stages={stages}
						stageKey={stageKey}
						selectedStage={selectedStage}
						stageTypes={stageTypes}
						addType={addType}
						titleRu={titleRu}
						stageEnabled={stageEnabled}
						sortOrder={sortOrder}
						settingsJson={settingsJson}
						showAdvancedSettings={showAdvancedSettings}
						onStageKeyChange={setStageKey}
						onAddTypeChange={setAddType}
						onTitleRuChange={setTitleRu}
						onStageEnabledChange={setStageEnabled}
						onSortOrderChange={setSortOrder}
						onSettingsJsonChange={setSettingsJson}
						onToggleAdvanced={() => setShowAdvancedSettings((open) => !open)}
						onSaveStage={() => void saveStage()}
						onMoveStage={(direction) => void moveStage(direction)}
						onRemoveStage={() => void removeStage()}
						onAddStage={() => void addStage()}
					/>
				</div>
			</div>
		</div>
	);
}
