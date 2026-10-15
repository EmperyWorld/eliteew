/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Config editor — Prompts tab (blueprint / lyrics / style system prompts).
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
import { patchMusicForgeAdminConfigPrompt } from './musicForgeAdminApi';
import {
	FieldLabel,
	asRecord,
	musicForgeConfigInputClass,
	strField,
} from './musicForgeConfigEditorShared';

export interface MusicForgeConfigPromptPanelProps {
	revisionId: string;
	isDraft: boolean;
	prompts: Record<string, unknown>;
	onSaved: () => Promise<void>;
	onError: (message: string) => void;
	onMessage: (message: string) => void;
}

export function MusicForgeConfigPromptPanel({
	revisionId,
	isDraft,
	prompts,
	onSaved,
	onError,
	onMessage,
}: MusicForgeConfigPromptPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [saving, setSaving] = React.useState(false);
	const [promptKind, setPromptKind] = React.useState('blueprint');
	const [systemPrompt, setSystemPrompt] = React.useState('');

	React.useEffect(() => {
		const prompt = asRecord(prompts[promptKind]);
		setSystemPrompt(strField(prompt, 'system_prompt'));
	}, [prompts, promptKind]);

	const savePrompt = async () => {
		if (!isDraft || !promptKind) return;
		setSaving(true);
		try {
			await patchMusicForgeAdminConfigPrompt(revisionId, promptKind, {
				system_prompt: systemPrompt,
			});
			onMessage(t('adminMusicForge.configEditorSaved'));
			await onSaved();
		} catch (err) {
			log.error(
				'MusicForgeConfigPromptPanel',
				'prompt save failed',
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
				<FieldLabel>{t('adminMusicForge.configEditorPromptKind')}</FieldLabel>
				<select
					className={inputClass}
					value={promptKind}
					onChange={(e) => setPromptKind(e.target.value)}
				>
					{['blueprint', 'lyrics', 'style'].map((kind) => (
						<option key={kind} value={kind}>
							{kind}
						</option>
					))}
				</select>
			</div>
			<div>
				<FieldLabel>{t('adminMusicForge.configEditorSystemPrompt')}</FieldLabel>
				<textarea
					className={`${inputClass} min-h-[160px] font-mono text-xs`}
					value={systemPrompt}
					disabled={!isDraft}
					onChange={(e) => setSystemPrompt(e.target.value)}
				/>
			</div>
			{isDraft ? (
				<AdminButton
					variant="primary"
					disabled={saving}
					onClick={() => void savePrompt()}
				>
					{saving
						? t('adminMusicForge.configEditorSaving')
						: t('adminMusicForge.configEditorSavePrompt')}
				</AdminButton>
			) : null}
		</div>
	);
}
