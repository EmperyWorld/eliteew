/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft Config editor shell for MusicForge Admin: tab navigation + load/diff;
 * lane/prompt/style/product/preview/pipeline live in dedicated panels.
 *
 * Invariants:
 * - Mutations (PATCH) only when revision.status === 'draft'; active/retired are preview/read-only.
 * - Pipeline tab composes Modes/stages from closed stage-type registry (Wave C).
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/musicForgeAdminApi.ts`
 * - `pages/Admin/musicForge/MusicForgePipelineBuilder.tsx`
 * - `documentation/product/MUSIC-FORGE-APP.md`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import { AdminButton } from '../ui';
import { MusicForgeConfigLanePanel } from './MusicForgeConfigLanePanel';
import { MusicForgeConfigPreviewPanel } from './MusicForgeConfigPreviewPanel';
import { MusicForgeConfigProductPanel } from './MusicForgeConfigProductPanel';
import { MusicForgeConfigPromptPanel } from './MusicForgeConfigPromptPanel';
import { MusicForgeConfigStylePanel } from './MusicForgeConfigStylePanel';
import { MusicForgePipelineBuilder } from './MusicForgePipelineBuilder';
import {
	type MusicForgeConfigRevisionDetailResponse,
	getMusicForgeAdminConfigDiff,
	getMusicForgeAdminConfigRevision,
} from './musicForgeAdminApi';
import { asRecord, adminUiMetaClass } from './musicForgeConfigEditorShared';

type EditorTab =
	| 'pipeline'
	| 'lanes'
	| 'prompts'
	| 'styles'
	| 'product'
	| 'preview';

const EDITOR_TAB_ORDER: EditorTab[] = [
	'pipeline',
	'lanes',
	'prompts',
	'styles',
	'product',
	'preview',
];

export interface MusicForgeConfigEditorProps {
	revisionId: string;
	onClose: () => void;
	onSaved?: () => void;
}

export function MusicForgeConfigEditor({
	revisionId,
	onClose,
	onSaved,
}: MusicForgeConfigEditorProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [detail, setDetail] =
		React.useState<MusicForgeConfigRevisionDetailResponse | null>(null);
	const [tab, setTab] = React.useState<EditorTab>('pipeline');
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);
	const [laneKey, setLaneKey] = React.useState('');
	const [styleKey, setStyleKey] = React.useState('');
	const [diffText, setDiffText] = React.useState<string | null>(null);

	const isDraft = detail?.revision.status === 'draft';

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const bundle = await getMusicForgeAdminConfigRevision(revisionId);
			setDetail(bundle);
			const lanes = bundle.lanes ?? {};
			const styles = bundle.styles ?? {};
			const laneKeys = Object.keys(lanes);
			const firstLane = laneKeys[0] ?? '';
			setLaneKey((prev) => (prev && lanes[prev] ? prev : firstLane));
			const styleKeys = Object.keys(styles);
			setStyleKey((prev) =>
				prev && styles[prev] ? prev : (styleKeys[0] ?? '')
			);
		} catch (err) {
			log.error(
				'MusicForgeConfigEditor',
				'load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.loadError'));
		} finally {
			setLoading(false);
		}
	}, [revisionId, t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const afterSaved = async () => {
		await load();
		onSaved?.();
	};

	const loadDiff = async () => {
		setError(null);
		try {
			const diff = await getMusicForgeAdminConfigDiff(revisionId);
			setDiffText(JSON.stringify(diff, null, 2));
		} catch (err) {
			log.error(
				'MusicForgeConfigEditor',
				'diff failed',
				err instanceof Error ? err : undefined
			);
			setError(
				err instanceof Error
					? err.message
					: t('adminMusicForge.configEditorDiffError')
			);
		}
	};

	const tabLabels: Record<EditorTab, string> = {
		pipeline: t('adminMusicForge.configEditorTabs.pipeline'),
		lanes: t('adminMusicForge.configEditorTabs.lanes'),
		prompts: t('adminMusicForge.configEditorTabs.prompts'),
		styles: t('adminMusicForge.configEditorTabs.styles'),
		product: t('adminMusicForge.configEditorTabs.product'),
		preview: t('adminMusicForge.configEditorTabs.preview'),
	};

	const laneKeys = React.useMemo(
		() => Object.keys(detail?.lanes ?? {}).sort(),
		[detail?.lanes]
	);

	if (loading && !detail) {
		return <p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>;
	}

	const editorTabs = EDITOR_TAB_ORDER.map((id) => ({
		id,
		label: tabLabels[id],
	}));

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-sm text-(--admin-ui-fg)">
						{detail?.revision.version ?? revisionId}
						<span className="ml-2 text-(--admin-ui-fg-muted)">
							({detail?.revision.status})
						</span>
					</p>
					{!isDraft ? (
						<p className={adminUiMetaClass}>
							{t('adminMusicForge.configEditorReadOnly')}
						</p>
					) : null}
				</div>
				<div className="flex flex-wrap gap-2">
					<AdminButton variant="secondary" onClick={() => void loadDiff()}>
						{t('adminMusicForge.configEditorDiff')}
					</AdminButton>
					<AdminButton variant="secondary" onClick={onClose}>
						{t('adminMusicForge.configEditorBack')}
					</AdminButton>
				</div>
			</div>

			{error ? <p className="text-sm text-red-300">{error}</p> : null}
			{message ? <p className="text-sm text-emerald-300">{message}</p> : null}

			<nav
				className="flex flex-wrap gap-1 border-b border-(--admin-ui-border) pb-2"
				aria-label={t('adminMusicForge.configEditorTabsAria')}
			>
				{editorTabs.map(({ id, label }) => (
					<AdminButton
						key={id}
						variant={tab === id ? 'primary' : 'secondary'}
						onClick={() => setTab(id)}
					>
						{label}
					</AdminButton>
				))}
			</nav>

			{tab === 'lanes' && detail ? (
				<MusicForgeConfigLanePanel
					revisionId={revisionId}
					isDraft={Boolean(isDraft)}
					lanes={detail.lanes ?? {}}
					laneKey={laneKey}
					onLaneKeyChange={setLaneKey}
					onSaved={afterSaved}
					onError={setError}
					onMessage={setMessage}
				/>
			) : null}

			{tab === 'prompts' && detail ? (
				<MusicForgeConfigPromptPanel
					revisionId={revisionId}
					isDraft={Boolean(isDraft)}
					prompts={detail.prompts ?? {}}
					onSaved={afterSaved}
					onError={setError}
					onMessage={setMessage}
				/>
			) : null}

			{tab === 'styles' && detail ? (
				<MusicForgeConfigStylePanel
					revisionId={revisionId}
					isDraft={Boolean(isDraft)}
					styles={detail.styles ?? {}}
					styleKey={styleKey}
					onStyleKeyChange={setStyleKey}
					onSaved={afterSaved}
					onError={setError}
					onMessage={setMessage}
				/>
			) : null}

			{tab === 'product' && detail ? (
				<MusicForgeConfigProductPanel
					revisionId={revisionId}
					isDraft={Boolean(isDraft)}
					product={detail.product}
					onSaved={afterSaved}
					onError={setError}
					onMessage={setMessage}
				/>
			) : null}

			{tab === 'pipeline' && detail ? (
				<MusicForgePipelineBuilder
					revisionId={revisionId}
					isDraft={Boolean(isDraft)}
					modes={asRecord(detail.modes)}
					pipelines={asRecord(detail.pipelines)}
					laneKeys={laneKeys}
					onChanged={afterSaved}
					onError={setError}
					onMessage={setMessage}
				/>
			) : null}

			{tab === 'preview' ? (
				<MusicForgeConfigPreviewPanel
					revisionId={revisionId}
					onError={setError}
				/>
			) : null}

			{diffText ? (
				<pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200">
					{diffText}
				</pre>
			) : null}
		</div>
	);
}
