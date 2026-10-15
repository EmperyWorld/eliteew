/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Mode create form for MusicForge Pipeline Builder (W7 atomization).
 *
 * Invariants:
 * - mode_key is set once at create; labels and lane_key are operator-editable.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgePipelineBuilder.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminButton } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';

const inputClass =
	'w-full rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] px-3 py-2 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)] placeholder:text-[var(--admin-ui-fg-dim)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ui-focus-ring)] focus-visible:ring-inset';

export type MusicForgePipelineBuilderModeFormProps = {
	laneKeys: string[];
	modeKey: string;
	labelRu: string;
	labelEn: string;
	laneKey: string;
	saving: boolean;
	onModeKeyChange: (value: string) => void;
	onLabelRuChange: (value: string) => void;
	onLabelEnChange: (value: string) => void;
	onLaneKeyChange: (value: string) => void;
	onSubmit: () => void;
	onCancel?: () => void;
	showIntro?: boolean;
};

export function MusicForgePipelineBuilderModeForm({
	laneKeys,
	modeKey,
	labelRu,
	labelEn,
	laneKey,
	saving,
	onModeKeyChange,
	onLabelRuChange,
	onLabelEnChange,
	onLaneKeyChange,
	onSubmit,
	onCancel,
	showIntro = false,
}: MusicForgePipelineBuilderModeFormProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');

	return (
		<div className="space-y-4">
			{showIntro ? (
				<>
					<p className="text-sm font-medium text-white">
						{t('adminMusicForge.pipelineCreateModeTitle')}
					</p>
					<p className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineCreateModeHint')}
					</p>
				</>
			) : null}
			<div className="grid gap-3 md:grid-cols-2">
				<label className="block space-y-1 md:col-span-2">
					<span className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineModeKey')}
					</span>
					<input
						className={inputClass}
						value={modeKey}
						onChange={(e) => onModeKeyChange(e.target.value)}
						placeholder={t('adminMusicForge.pipelineModeKeyPh')}
					/>
				</label>
				<label className="block space-y-1">
					<span className={adminUiMetaClass}>
						{t('adminMusicForge.pipelineLabelRu')}
					</span>
					<input
						className={inputClass}
						value={labelRu}
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
			<div className="flex flex-wrap gap-2">
				<AdminButton variant="primary" disabled={saving} onClick={onSubmit}>
					{saving
						? t('adminMusicForge.configEditorSaving')
						: t('adminMusicForge.pipelineAddMode')}
				</AdminButton>
				{onCancel ? (
					<AdminButton variant="secondary" disabled={saving} onClick={onCancel}>
						{t('adminMusicForge.pipelineCreateModeCancel')}
					</AdminButton>
				) : null}
			</div>
		</div>
	);
}
