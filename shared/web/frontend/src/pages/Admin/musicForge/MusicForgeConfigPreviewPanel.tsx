/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft/active Config editor — Preview tab (dry-run audio payload, no enqueue).
 *
 * Invariants:
 * - Preview is dry-run only; shows resolved_builder + input_data.
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
import {
	type MusicForgePreviewAudioResponse,
	previewMusicForgeAdminAudioPayload,
	requireMusicForgePreviewAudioResponse,
} from './musicForgeAdminApi';
import {
	FieldLabel,
	adminUiMetaClass,
	musicForgeConfigInputClass,
} from './musicForgeConfigEditorShared';

export interface MusicForgeConfigPreviewPanelProps {
	revisionId: string;
	onError: (message: string) => void;
}

export function MusicForgeConfigPreviewPanel({
	revisionId,
	onError,
}: MusicForgeConfigPreviewPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [previewIdea, setPreviewIdea] = React.useState(
		'Admin preview song idea'
	);
	const [preview, setPreview] =
		React.useState<MusicForgePreviewAudioResponse | null>(null);
	const [previewing, setPreviewing] = React.useState(false);

	const runPreview = async () => {
		setPreviewing(true);
		try {
			const raw = await previewMusicForgeAdminAudioPayload(revisionId, {
				idea: previewIdea.trim() || 'Admin preview song idea',
				language: 'auto',
				duration_seconds: 180,
			});
			setPreview(requireMusicForgePreviewAudioResponse(raw));
		} catch (err) {
			log.error(
				'MusicForgeConfigPreviewPanel',
				'preview failed',
				err instanceof Error ? err : undefined
			);
			onError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorPreviewError')
			);
			setPreview(null);
		} finally {
			setPreviewing(false);
		}
	};

	const inputClass = musicForgeConfigInputClass;

	return (
		<div className="space-y-3 rounded-xl border border-white/10 bg-white/2 p-4">
			<p className={adminUiMetaClass}>
				{t('adminMusicForge.configEditorPreviewHint')}
			</p>
			<div>
				<FieldLabel>{t('adminMusicForge.configEditorPreviewIdea')}</FieldLabel>
				<input
					className={inputClass}
					value={previewIdea}
					onChange={(e) => setPreviewIdea(e.target.value)}
				/>
			</div>
			<AdminButton
				variant="primary"
				disabled={previewing}
				onClick={() => void runPreview()}
			>
				{previewing
					? t('adminMusicForge.configEditorPreviewRunning')
					: t('adminMusicForge.configEditorPreviewRun')}
			</AdminButton>
			{preview ? (
				<div className="space-y-2">
					<p className="text-sm text-slate-200">
						{t('adminMusicForge.configEditorPreviewMeta', {
							lane: preview.lane_key,
							builder: preview.resolved_builder,
							workflow: preview.ugs_workflow,
						})}
					</p>
					<pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200">
						{JSON.stringify(preview.input_data, null, 2)}
					</pre>
				</div>
			) : null}
		</div>
	);
}
