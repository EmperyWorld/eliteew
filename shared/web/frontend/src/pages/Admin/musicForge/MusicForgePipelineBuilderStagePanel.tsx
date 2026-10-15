/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stage list + detail editor for MusicForge Pipeline Builder.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgePipelineBuilder.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminButton, adminUiFieldClass } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import type { MusicForgeStageRow } from './musicForgeAdminApi';

const inputClass = adminUiFieldClass;
const panelClass =
	'rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4';

export type MusicForgePipelineBuilderStagePanelProps = {
	isDraft: boolean;
	saving: boolean;
	stages: MusicForgeStageRow[];
	stageKey: string;
	selectedStage?: MusicForgeStageRow;
	stageTypes: string[];
	addType: string;
	titleRu: string;
	stageEnabled: boolean;
	sortOrder: string;
	settingsJson: string;
	showAdvancedSettings: boolean;
	onStageKeyChange: (value: string) => void;
	onAddTypeChange: (value: string) => void;
	onTitleRuChange: (value: string) => void;
	onStageEnabledChange: (value: boolean) => void;
	onSortOrderChange: (value: string) => void;
	onSettingsJsonChange: (value: string) => void;
	onToggleAdvanced: () => void;
	onSaveStage: () => void;
	onMoveStage: (direction: -1 | 1) => void;
	onRemoveStage: () => void;
	onAddStage: () => void;
};

export function MusicForgePipelineBuilderStagePanel({
	isDraft,
	saving,
	stages,
	stageKey,
	selectedStage,
	stageTypes,
	addType,
	titleRu,
	stageEnabled,
	sortOrder,
	settingsJson,
	showAdvancedSettings,
	onStageKeyChange,
	onAddTypeChange,
	onTitleRuChange,
	onStageEnabledChange,
	onSortOrderChange,
	onSettingsJsonChange,
	onToggleAdvanced,
	onSaveStage,
	onMoveStage,
	onRemoveStage,
	onAddStage,
}: MusicForgePipelineBuilderStagePanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');

	return (
		<section className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
			<div className={`${panelClass} space-y-3`}>
				<div>
					<h3 className="text-sm font-medium text-white">
						{t('adminMusicForge.pipelineStagesHeading')}
					</h3>
					<p className={`mt-1 ${adminUiMetaClass}`}>
						{t('adminMusicForge.pipelineStagesHint')}
					</p>
				</div>
				<ol className="space-y-1.5">
					{stages.map((s, index) => {
						const active = s.stage_key === stageKey;
						return (
							<li key={s.stage_key}>
								<button
									type="button"
									onClick={() => onStageKeyChange(s.stage_key)}
									className={`w-full rounded-xl border px-3 py-2 text-left ${
										active
											? 'border-violet-400/40 bg-violet-600/20 text-white'
											: 'border-white/10 bg-black/20 text-slate-200 hover:bg-white/5'
									}`}
								>
									<span className="block text-sm">
										{index + 1}. {s.title_ru || s.stage_key}
									</span>
									<span className="mt-0.5 block text-[11px] text-slate-500">
										{s.stage_type}
										{s.enabled
											? ''
											: ` · ${t('adminMusicForge.pipelineDisabled')}`}
									</span>
								</button>
							</li>
						);
					})}
				</ol>
				{stages.length === 0 ? (
					<p className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineStagesEmpty')}
					</p>
				) : null}

				{isDraft ? (
					<div className="space-y-2 border-t border-white/10 pt-3">
						<label className="block space-y-1">
							<span className={adminUiMetaClass}>
								{t('adminMusicForge.pipelineAddStageType')}
							</span>
							<select
								className={inputClass}
								value={addType}
								onChange={(e) => onAddTypeChange(e.target.value)}
							>
								{(stageTypes.length ? stageTypes : [addType]).map((type) => (
									<option key={type} value={type}>
										{type}
									</option>
								))}
							</select>
						</label>
						<AdminButton
							variant="secondary"
							disabled={saving}
							onClick={onAddStage}
						>
							{t('adminMusicForge.pipelineAddStage')}
						</AdminButton>
					</div>
				) : null}
			</div>

			<div className={`${panelClass} space-y-4`}>
				{selectedStage ? (
					<>
						<div>
							<h3 className="text-sm font-medium text-white">
								{t('adminMusicForge.pipelineStageDetailTitle')}
							</h3>
							<p className="mt-1 font-mono text-[11px] text-slate-500">
								{selectedStage.stage_key} · {selectedStage.stage_type}
							</p>
						</div>
						<label className="block space-y-1">
							<span className={adminUiMetaClass}>
								{t('adminMusicForge.pipelineStageTitle')}
							</span>
							<input
								className={inputClass}
								value={titleRu}
								disabled={!isDraft}
								onChange={(e) => onTitleRuChange(e.target.value)}
							/>
						</label>
						<label className="flex items-center gap-2 text-sm text-slate-200">
							<input
								type="checkbox"
								checked={stageEnabled}
								disabled={!isDraft}
								onChange={(e) => onStageEnabledChange(e.target.checked)}
							/>
							{t('adminMusicForge.pipelineEnabled')}
						</label>

						{isDraft ? (
							<div className="flex flex-wrap gap-2">
								<AdminButton
									variant="primary"
									disabled={saving}
									onClick={onSaveStage}
								>
									{saving
										? t('adminMusicForge.configEditorSaving')
										: t('adminMusicForge.pipelineSaveStage')}
								</AdminButton>
								<AdminButton
									variant="secondary"
									disabled={saving}
									onClick={() => onMoveStage(-1)}
								>
									{t('adminMusicForge.pipelineMoveUp')}
								</AdminButton>
								<AdminButton
									variant="secondary"
									disabled={saving}
									onClick={() => onMoveStage(1)}
								>
									{t('adminMusicForge.pipelineMoveDown')}
								</AdminButton>
								<AdminButton
									variant="danger"
									disabled={saving}
									onClick={onRemoveStage}
								>
									{t('adminMusicForge.pipelineDeleteStage')}
								</AdminButton>
							</div>
						) : null}

						<div className="border-t border-(--admin-ui-border) pt-3">
							<AdminButton
								variant="secondary"
								className="w-full sm:w-auto"
								onClick={onToggleAdvanced}
							>
								{showAdvancedSettings
									? t('adminMusicForge.pipelineHideAdvanced')
									: t('adminMusicForge.pipelineShowAdvanced')}
							</AdminButton>
							{showAdvancedSettings ? (
								<div className="mt-3 space-y-3">
									<label className="block space-y-1">
										<span className={adminUiMetaClass}>
											{t('adminMusicForge.pipelineSortOrder')}
										</span>
										<input
											className={inputClass}
											value={sortOrder}
											disabled={!isDraft}
											onChange={(e) => onSortOrderChange(e.target.value)}
										/>
									</label>
									<label className="block space-y-1">
										<span className={adminUiMetaClass}>
											{t('adminMusicForge.pipelineSettingsJson')}
										</span>
										<textarea
											className={`${inputClass} min-h-35 font-mono text-xs`}
											value={settingsJson}
											disabled={!isDraft}
											onChange={(e) => onSettingsJsonChange(e.target.value)}
										/>
									</label>
								</div>
							) : null}
						</div>
					</>
				) : (
					<p className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineStageSelectHint')}
					</p>
				)}
			</div>
		</section>
	);
}
