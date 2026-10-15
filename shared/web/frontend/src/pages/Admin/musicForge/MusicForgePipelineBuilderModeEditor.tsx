/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Mode label/lane editor panel for MusicForge Pipeline Builder.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgePipelineBuilder.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminButton, adminUiFieldClass } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import type { MusicForgeModeRow } from './musicForgeAdminApi';

const inputClass = adminUiFieldClass;
const panelClass =
	'rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4';

export type MusicForgePipelineBuilderModeEditorProps = {
	isDraft: boolean;
	saving: boolean;
	modeCount: number;
	selectedMode?: MusicForgeModeRow;
	laneKeys: string[];
	labelRu: string;
	labelEn: string;
	laneKey: string;
	enabled: boolean;
	isDefault: boolean;
	onLabelRuChange: (value: string) => void;
	onLabelEnChange: (value: string) => void;
	onLaneKeyChange: (value: string) => void;
	onEnabledChange: (value: boolean) => void;
	onIsDefaultChange: (value: boolean) => void;
	onSave: () => void;
	onDelete: () => void;
};

export function MusicForgePipelineBuilderModeEditor({
	isDraft,
	saving,
	modeCount,
	selectedMode,
	laneKeys,
	labelRu,
	labelEn,
	laneKey,
	enabled,
	isDefault,
	onLabelRuChange,
	onLabelEnChange,
	onLaneKeyChange,
	onEnabledChange,
	onIsDefaultChange,
	onSave,
	onDelete,
}: MusicForgePipelineBuilderModeEditorProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');

	return (
		<section className={`${panelClass} space-y-4`}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h3 className="text-sm font-medium text-white">
						{t('adminMusicForge.pipelineModeCardTitle')}
					</h3>
					<p className={`mt-1 ${adminUiMetaClass}`}>
						{t('adminMusicForge.pipelineDisplayNameHint')}
					</p>
				</div>
				{selectedMode ? (
					<span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] text-slate-400">
						{selectedMode.mode_key}
					</span>
				) : null}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<label className="block space-y-1">
					<span className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineLabelRu')}
					</span>
					<input
						className={inputClass}
						value={labelRu}
						disabled={!isDraft}
						onChange={(e) => onLabelRuChange(e.target.value)}
						placeholder={t('adminMusicForge.pipelineLabelRuPh')}
					/>
				</label>
				<label className="block space-y-1">
					<span className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineLabelEn')}
					</span>
					<input
						className={inputClass}
						value={labelEn}
						disabled={!isDraft}
						onChange={(e) => onLabelEnChange(e.target.value)}
						placeholder={t('adminMusicForge.pipelineLabelEnPh')}
					/>
				</label>
				<label className="block space-y-1 md:col-span-2">
					<span className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineLaneKey')}
					</span>
					<select
						className={inputClass}
						value={laneKey}
						disabled={!isDraft}
						onChange={(e) => onLaneKeyChange(e.target.value)}
					>
						{laneKeys.map((k) => (
							<option key={k} value={k}>
								{k}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="flex flex-wrap gap-4">
				<label className="flex items-center gap-2 text-sm text-slate-200">
					<input
						type="checkbox"
						checked={enabled}
						disabled={!isDraft}
						onChange={(e) => onEnabledChange(e.target.checked)}
					/>
					{t('adminMusicForge.pipelineEnabled')}
				</label>
				<label className="flex items-center gap-2 text-sm text-slate-200">
					<input
						type="checkbox"
						checked={isDefault}
						disabled={!isDraft}
						onChange={(e) => onIsDefaultChange(e.target.checked)}
					/>
					{t('adminMusicForge.pipelineIsDefault')}
				</label>
			</div>

			{isDraft ? (
				<div className="flex flex-wrap gap-2">
					<AdminButton variant="primary" disabled={saving} onClick={onSave}>
						{saving
							? t('adminMusicForge.configEditorSaving')
							: t('adminMusicForge.pipelineSaveMode')}
					</AdminButton>
					{modeCount > 1 ? (
						<AdminButton variant="danger" disabled={saving} onClick={onDelete}>
							{t('adminMusicForge.pipelineDeleteMode')}
						</AdminButton>
					) : null}
				</div>
			) : null}
		</section>
	);
}
