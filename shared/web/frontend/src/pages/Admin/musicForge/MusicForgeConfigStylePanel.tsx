/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Config editor — Styles tab (keyscale / vocal / BPM defaults).
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
import { patchMusicForgeAdminConfigStyle } from './musicForgeAdminApi';
import {
	FieldLabel,
	asRecord,
	musicForgeConfigInputClass,
	numField,
	strField,
} from './musicForgeConfigEditorShared';

export interface MusicForgeConfigStylePanelProps {
	revisionId: string;
	isDraft: boolean;
	styles: Record<string, unknown>;
	styleKey: string;
	onStyleKeyChange: (key: string) => void;
	onSaved: () => Promise<void>;
	onError: (message: string) => void;
	onMessage: (message: string) => void;
}

export function MusicForgeConfigStylePanel({
	revisionId,
	isDraft,
	styles,
	styleKey,
	onStyleKeyChange,
	onSaved,
	onError,
	onMessage,
}: MusicForgeConfigStylePanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [saving, setSaving] = React.useState(false);
	const [keyscale, setKeyscale] = React.useState('');
	const [defaultVocal, setDefaultVocal] = React.useState('');
	const [bpmDefault, setBpmDefault] = React.useState('120');

	React.useEffect(() => {
		if (!styleKey) return;
		const style = asRecord(styles[styleKey]);
		setKeyscale(strField(style, 'keyscale'));
		setDefaultVocal(strField(style, 'default_vocal'));
		setBpmDefault(String(numField(style, 'bpm_default', 120)));
	}, [styles, styleKey]);

	const saveStyle = async () => {
		if (!isDraft || !styleKey) return;
		setSaving(true);
		try {
			await patchMusicForgeAdminConfigStyle(revisionId, styleKey, {
				keyscale: keyscale.trim() || undefined,
				default_vocal: defaultVocal.trim() || undefined,
				bpm_default: Number(bpmDefault),
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onSaved();
		} catch (err) {
			log.error(
				'MusicForgeConfigStylePanel',
				'style save failed',
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
			<div>
				<FieldLabel>{t('adminMusicForge.configEditorStyleKey')}</FieldLabel>
				<select
					className={inputClass}
					value={styleKey}
					onChange={(e) => onStyleKeyChange(e.target.value)}
				>
					{Object.keys(styles).map((key) => (
						<option key={key} value={key}>
							{key}
						</option>
					))}
				</select>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div>
					<FieldLabel>{t('adminMusicForge.configEditorKeyscale')}</FieldLabel>
					<input
						className={inputClass}
						value={keyscale}
						disabled={!isDraft}
						onChange={(e) => setKeyscale(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>
						{t('adminMusicForge.configEditorDefaultVocal')}
					</FieldLabel>
					<input
						className={inputClass}
						value={defaultVocal}
						disabled={!isDraft}
						onChange={(e) => setDefaultVocal(e.target.value)}
					/>
				</div>
				<div>
					<FieldLabel>{t('adminMusicForge.configEditorBpmDefault')}</FieldLabel>
					<input
						className={inputClass}
						value={bpmDefault}
						disabled={!isDraft}
						onChange={(e) => setBpmDefault(e.target.value)}
					/>
				</div>
			</div>
			{isDraft ? (
				<AdminButton
					variant="primary"
					disabled={saving}
					onClick={() => void saveStyle()}
				>
					{saving
						? t('adminMusicForge.configEditorSaving')
						: t('adminMusicForge.configEditorSaveStyle')}
				</AdminButton>
			) : null}
		</div>
	);
}
