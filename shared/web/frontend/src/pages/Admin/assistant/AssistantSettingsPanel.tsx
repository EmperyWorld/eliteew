/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assistant LLM/RAG settings form panel in product admin.
 *
 * Invariants:
 * - rag_top_k clamped to 1–32 in UI.
 *
 * Related:
 * - pages/Admin/assistant/useAssistantAdminSettings.ts
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { ADMIN_FIELD, ADMIN_FIELD_SM } from './assistantAdminStyles';

type AssistantSettingsPanelProps = {
	llamaModelDraft: string;
	setLlamaModelDraft: (v: string) => void;
	extraPromptDraft: string;
	setExtraPromptDraft: (v: string) => void;
	ragEnabledDraft: boolean;
	setRagEnabledDraft: (v: boolean) => void;
	ragTopKDraft: number;
	setRagTopKDraft: (v: number) => void;
	onSave: () => void;
	isSaving: boolean;
};

export function AssistantSettingsPanel({
	llamaModelDraft,
	setLlamaModelDraft,
	extraPromptDraft,
	setExtraPromptDraft,
	ragEnabledDraft,
	setRagEnabledDraft,
	ragTopKDraft,
	setRagTopKDraft,
	onSave,
	isSaving,
}: AssistantSettingsPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	return (
		<div
			className={cn(
				'border border-white/10 bg-white/3 p-4 space-y-3 shadow-sm shadow-black/25',
				DESKTOP_SURFACE.radius
			)}
		>
			<div className={DESKTOP_TYPOGRAPHY.caption}>{t('settingsCaption')}</div>
			<label className="block text-xs text-white/60">
				{t('llamaModelLabel')}
				<input
					type="text"
					value={llamaModelDraft}
					onChange={(e) => setLlamaModelDraft(e.target.value)}
					className={cn('mt-1 w-full', ADMIN_FIELD)}
				/>
			</label>
			<label className="block text-xs text-white/60">
				{t('extraPromptLabel')}
				<textarea
					rows={2}
					value={extraPromptDraft}
					onChange={(e) => setExtraPromptDraft(e.target.value)}
					className={cn('mt-1 w-full', ADMIN_FIELD)}
				/>
			</label>
			<label className="flex items-center gap-2 text-sm text-white/80">
				<input
					type="checkbox"
					checked={ragEnabledDraft}
					onChange={(e) => setRagEnabledDraft(e.target.checked)}
				/>
				{t('ragEnableLabel')}
			</label>
			<label className="block text-xs text-white/60">
				{t('ragTopKLabel')}
				<input
					type="number"
					min={1}
					max={32}
					value={ragTopKDraft}
					onChange={(e) => {
						const raw = e.target.value;
						const n = Number.parseInt(raw, 10);
						if (raw === '' || Number.isNaN(n)) {
							setRagTopKDraft(1);
							return;
						}
						setRagTopKDraft(Math.min(32, Math.max(1, n)));
					}}
					className={cn('mt-1 w-24', ADMIN_FIELD_SM)}
				/>
			</label>
			<button
				type="button"
				disabled={isSaving}
				onClick={onSave}
				className={cn(
					'px-4 py-2 text-sm text-white',
					DESKTOP_SURFACE.radius,
					DESKTOP_INTERACTIVE.btnRounded,
					'bg-white/10 hover:bg-white/18 border border-white/10',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45'
				)}
			>
				{t('saveSettings')}
			</button>
		</div>
	);
}
