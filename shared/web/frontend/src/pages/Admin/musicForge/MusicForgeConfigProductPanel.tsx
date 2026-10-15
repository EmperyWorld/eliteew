/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Config editor — Product tab (duration bounds, MVP lane, audio type key).
 *
 * Invariants:
 * - PATCH only when isDraft.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgeConfigEditor.tsx`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import { AdminButton } from '../ui';
import { patchMusicForgeAdminConfigProduct } from './musicForgeAdminApi';
import {
	FieldLabel,
	asRecord,
	musicForgeConfigInputClass,
	numField,
	strField,
} from './musicForgeConfigEditorShared';

export interface MusicForgeConfigProductPanelProps {
	revisionId: string;
	isDraft: boolean;
	product: unknown;
	onSaved: () => Promise<void>;
	onError: (message: string) => void;
	onMessage: (message: string) => void;
}

export function MusicForgeConfigProductPanel({
	revisionId,
	isDraft,
	product,
	onSaved,
	onError,
	onMessage,
}: MusicForgeConfigProductPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [saving, setSaving] = React.useState(false);
	const [durationMin, setDurationMin] = React.useState('60');
	const [durationMax, setDurationMax] = React.useState('240');
	const [durationDefault, setDurationDefault] = React.useState('180');
	const [mvpLaneLabel, setMvpLaneLabel] = React.useState('');
	const [audioTypeKey, setAudioTypeKey] = React.useState('');

	React.useEffect(() => {
		const row = asRecord(product);
		setDurationMin(String(numField(row, 'duration_min', 60)));
		setDurationMax(String(numField(row, 'duration_max', 240)));
		setDurationDefault(String(numField(row, 'duration_default', 180)));
		setMvpLaneLabel(strField(row, 'mvp_lane_label'));
		setAudioTypeKey(strField(row, 'audio_type_key'));
	}, [product]);

	const saveProduct = async () => {
		if (!isDraft) return;
		setSaving(true);
		try {
			await patchMusicForgeAdminConfigProduct(revisionId, {
				duration_min: Number(durationMin),
				duration_max: Number(durationMax),
				duration_default: Number(durationDefault),
				mvp_lane_label: mvpLaneLabel.trim() || undefined,
				audio_type_key: audioTypeKey.trim() || undefined,
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onSaved();
		} catch (err) {
			log.error(
				'MusicForgeConfigProductPanel',
				'product save failed',
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

	const inputClass = musicForgeConfigInputClass;

	return (
		<div className="space-y-3 rounded-xl border border-white/10 bg-white/2 p-4">
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorDurationMin')}
					</FieldLabel>
					<input
						className={inputClass}
						value={durationMin}
						disabled={!isDraft}
						onChange={(e) => setDurationMin(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorDurationMax')}
					</FieldLabel>
					<input
						className={inputClass}
						value={durationMax}
						disabled={!isDraft}
						onChange={(e) => setDurationMax(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorDurationDefault')}
					</FieldLabel>
					<input
						className={inputClass}
						value={durationDefault}
						disabled={!isDraft}
						onChange={(e) => setDurationDefault(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorMvpLaneLabel')}
					</FieldLabel>
					<input
						className={inputClass}
						value={mvpLaneLabel}
						disabled={!isDraft}
						onChange={(e) => setMvpLaneLabel(e.target.value)}
					/>
				</div>
				<div className="sm:col-span-2">
					<FieldLabel>
						{t('adminMusicForge.configEditorAudioTypeKey')}
					</FieldLabel>
					<input
						className={inputClass}
						value={audioTypeKey}
						disabled={!isDraft}
						onChange={(e) => setAudioTypeKey(e.target.value)}
					/>
				</div>
			</div>
			{isDraft ? (
				<AdminButton
					variant="primary"
					disabled={saving}
					onClick={() => void saveProduct()}
				>
					{saving
						? t('adminMusicForge.configEditorSaving')
						: t('adminMusicForge.configEditorSaveProduct')}
				</AdminButton>
			) : null}
		</div>
	);
}
