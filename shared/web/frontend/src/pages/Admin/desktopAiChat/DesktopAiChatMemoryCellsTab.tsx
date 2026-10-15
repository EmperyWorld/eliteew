/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dedicated admin form for Desktop AI Chat Memory Cells global defaults.
 *
 * Invariants:
 * - Saves only via saveDefaultsPatch merge of memory_cells_* keys.
 *
 * Related:
 * - desktopAiChatAdminMemoryCells.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import { DesktopAiChatAdminNumberField } from './DesktopAiChatAdminNumberField';
import { useDesktopAiChatAdmin } from './DesktopAiChatAdminContext';
import { DesktopAiChatAdminStatusBanner } from './DesktopAiChatAdminStatusBanner';
import {
	mergeMemoryCellsForm,
	readMemoryCellsForm,
	type DesktopAiChatMemoryCellsForm,
} from './desktopAiChatAdminMemoryCells';

export function DesktopAiChatMemoryCellsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const { defaults, saveState, statusKind, statusMessage, saveDefaultsPatch } =
		useDesktopAiChatAdmin();
	const [form, setForm] = React.useState<DesktopAiChatMemoryCellsForm>(() =>
		readMemoryCellsForm(defaults)
	);
	const busy = saveState === 'saving';

	React.useEffect(() => {
		setForm(readMemoryCellsForm(defaults));
	}, [defaults]);

	const onSave = async () => {
		const patch = mergeMemoryCellsForm(defaults, form);
		const ok = await saveDefaultsPatch(patch);
		if (ok) {
			setForm(readMemoryCellsForm(patch));
		}
	};

	return (
		<div className="space-y-4 max-w-3xl">
			<DesktopAiChatAdminStatusBanner
				kind={statusKind}
				message={statusMessage}
			/>
			<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/75`}>
				{t('adminAiChat.memoryCells.lead')}
			</p>

			<label
				htmlFor="dac-mc-enabled"
				className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
			>
				<input
					id="dac-mc-enabled"
					type="checkbox"
					className="mt-1 rounded border-white/20 bg-black/40"
					checked={form.enabled}
					disabled={busy}
					onChange={(e) =>
						setForm((prev) => ({ ...prev, enabled: e.target.checked }))
					}
				/>
				<span className="min-w-0 flex-1">
					<span className="font-medium text-white/95">
						{t('adminAiChat.memoryCells.enabled')}
					</span>
					<span
						className={`${DESKTOP_TYPOGRAPHY.caption} mt-0.5 block text-white/55`}
					>
						{t('adminAiChat.memoryCells.enabledHint')}
					</span>
				</span>
			</label>

			<div className="grid gap-4 sm:grid-cols-2">
				<DesktopAiChatAdminNumberField
					id="dac-mc-max-user"
					label={t('adminAiChat.memoryCells.maxPerUser')}
					hint={t('adminAiChat.memoryCells.maxPerUserHint')}
					value={form.maxPerUser}
					min={1}
					max={5}
					disabled={busy}
					onChange={(maxPerUser) =>
						setForm((prev) => ({ ...prev, maxPerUser }))
					}
				/>
				<DesktopAiChatAdminNumberField
					id="dac-mc-top-k"
					label={t('adminAiChat.memoryCells.retrievalTopK')}
					hint={t('adminAiChat.memoryCells.retrievalTopKHint')}
					value={form.retrievalTopK}
					min={1}
					max={32}
					disabled={busy}
					onChange={(retrievalTopK) =>
						setForm((prev) => ({ ...prev, retrievalTopK }))
					}
				/>
				<DesktopAiChatAdminNumberField
					id="dac-mc-max-messages"
					label={t('adminAiChat.memoryCells.maxMessages')}
					value={form.maxMessages}
					min={20}
					max={2000}
					disabled={busy}
					onChange={(maxMessages) =>
						setForm((prev) => ({ ...prev, maxMessages }))
					}
				/>
				<DesktopAiChatAdminNumberField
					id="dac-mc-max-chunks"
					label={t('adminAiChat.memoryCells.maxChunks')}
					value={form.maxChunks}
					min={16}
					max={1024}
					disabled={busy}
					onChange={(maxChunks) => setForm((prev) => ({ ...prev, maxChunks }))}
				/>
				<DesktopAiChatAdminNumberField
					id="dac-mc-min-score"
					label={t('adminAiChat.memoryCells.minScore')}
					hint={t('adminAiChat.memoryCells.minScoreHint')}
					value={form.minScore}
					min={0}
					max={1}
					step={0.05}
					disabled={busy}
					onChange={(minScore) => setForm((prev) => ({ ...prev, minScore }))}
				/>
			</div>

			<div className="flex flex-wrap gap-2 pt-2">
				<button
					type="button"
					disabled={busy}
					onClick={() => void onSave()}
					className={`${DESKTOP_INTERACTIVE.btnRounded} bg-violet-600/80 px-4 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50`}
				>
					{busy ? t('adminAiChat.saving') : t('adminAiChat.saveDefaults')}
				</button>
			</div>
		</div>
	);
}
