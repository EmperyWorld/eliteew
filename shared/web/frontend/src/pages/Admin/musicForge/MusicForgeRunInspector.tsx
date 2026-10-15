/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin run inspector with accordion sections for song review.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import { MusicForgeRunMetaChips } from '../../MusicForge/MusicForgeRunMetaChips';
import {
	musicForgeExtraConstraintsFromPayload,
	parseMusicForgeVocalFromConstraints,
	resolveMusicForgeContentId,
} from '../../MusicForge/musicForgeUiHelpers';
import { AdminButton } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import { MusicForgeAdminInspectorSection } from './MusicForgeAdminInspectorSection';
import { MusicForgeAdminRunProgressBar } from './MusicForgeAdminRunProgressBar';
import { MusicForgeAdminRunStatusBadge } from './MusicForgeAdminRunStatusBadge';
import {
	formatMusicForgeAdminDateTime,
	formatMusicForgeAdminDuration,
	lyricsFromPayload,
	resultDownloadUrl,
	resultTrackName,
} from './musicForgeAdminRunHelpers';
import {
	type MusicForgeAdminRunDetail,
	getMusicForgeAdminRun,
} from './musicForgeAdminApi';

function asRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

function strFrom(record: Record<string, unknown>, key: string): string {
	const v = record[key];
	return typeof v === 'string' && v.trim() ? v : '—';
}

function errorMessage(payload: Record<string, unknown>): string | null {
	const msg = payload.message;
	if (typeof msg === 'string' && msg.trim()) return msg;
	const stage = payload.stage;
	if (typeof stage === 'string' && stage.trim()) return stage;
	return null;
}

const LYRICS_PREVIEW_LINES = 12;

export interface MusicForgeRunInspectorProps {
	runId: string;
	onClose: () => void;
	embedded?: boolean;
}

export function MusicForgeRunInspector({
	runId,
	onClose,
	embedded = false,
}: MusicForgeRunInspectorProps): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi');
	const [detail, setDetail] = React.useState<MusicForgeAdminRunDetail | null>(
		null
	);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [lyricsExpanded, setLyricsExpanded] = React.useState(false);

	React.useEffect(() => {
		let alive = true;
		setLoading(true);
		setError(null);
		void getMusicForgeAdminRun(runId)
			.then((row) => {
				if (!alive) return;
				setDetail(row);
			})
			.catch((err: unknown) => {
				log.error(
					'MusicForgeRunInspector',
					'load failed',
					err instanceof Error ? err : undefined
				);
				if (!alive) return;
				setError(
					err instanceof Error ? err.message : t('adminMusicForge.loadError')
				);
				setDetail(null);
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [runId, t]);

	const normalized = asRecord(detail?.normalized_input);
	const runError = detail ? errorMessage(asRecord(detail.error_payload)) : null;
	const vocal = detail
		? parseMusicForgeVocalFromConstraints(detail.constraints)
		: null;
	const extraConstraints = detail
		? musicForgeExtraConstraintsFromPayload(detail.constraints)
		: '';
	const lyrics = detail ? lyricsFromPayload(detail.lyrics_payload) : '';
	const lyricsLines = lyrics ? lyrics.split('\n') : [];
	const lyricsPreview = lyricsExpanded
		? lyrics
		: lyricsLines.slice(0, LYRICS_PREVIEW_LINES).join('\n');
	const trackName = detail ? resultTrackName(detail.result_payload) : '';
	const downloadUrl = detail ? resultDownloadUrl(detail.result_payload) : '';
	const contentId = detail ? resolveMusicForgeContentId(detail) : '';
	const stepsCount = detail?.steps?.length ?? 0;

	return (
		<div
			className={
				embedded
					? 'space-y-4'
					: 'space-y-4 rounded-xl border border-white/10 bg-white/2 p-4'
			}
		>
			{!embedded ? (
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div>
						<p className="text-sm font-medium text-white">
							{t('adminMusicForge.inspectorTitle')}
						</p>
						<p className={`mt-1 font-mono text-xs ${adminUiMetaClass}`}>
							{runId}
						</p>
					</div>
					<AdminButton variant="secondary" onClick={onClose}>
						{t('adminMusicForge.inspectorClose')}
					</AdminButton>
				</div>
			) : (
				<p className={`font-mono text-xs ${adminUiMetaClass}`}>{runId}</p>
			)}

			{loading ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>
			) : null}
			{error ? <p className="text-sm text-red-300">{error}</p> : null}

			{detail ? (
				<div className="space-y-3">
					<MusicForgeAdminInspectorSection
						title={t('adminMusicForge.inspectorSectionSummary')}
						defaultOpen
						badge={<MusicForgeAdminRunStatusBadge status={detail.status} />}
					>
						<div className="space-y-3">
							<p className={adminUiMetaClass}>
								{formatMusicForgeAdminDateTime(
									detail.created_at,
									i18n.language
								)}
							</p>
							<MusicForgeRunMetaChips
								vocal={vocal}
								styleHint={detail.style_hint}
								language={detail.language}
								durationSeconds={detail.duration_seconds}
							/>
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.runsIdea')}
								</p>
								<p className="text-sm text-[var(--admin-ui-fg)]">
									{detail.idea}
								</p>
							</div>
							{extraConstraints ? (
								<div>
									<p className={adminUiMetaClass}>
										{t('adminMusicForge.inspectorConstraints')}
									</p>
									<p className="text-sm text-[var(--admin-ui-fg-muted)]">
										{extraConstraints}
									</p>
								</div>
							) : null}
							{detail.progress_total > 0 ? (
								<MusicForgeAdminRunProgressBar
									current={detail.progress_current}
									total={detail.progress_total}
								/>
							) : null}
						</div>
					</MusicForgeAdminInspectorSection>

					{detail.status === 'completed' &&
					(trackName || contentId || downloadUrl) ? (
						<MusicForgeAdminInspectorSection
							title={t('adminMusicForge.inspectorResult')}
							defaultOpen
						>
							{trackName ? (
								<p className="text-sm font-medium text-[var(--admin-ui-fg)]">
									{trackName}
								</p>
							) : null}
							{contentId ? (
								<p className={`mt-1 font-mono text-xs ${adminUiMetaClass}`}>
									{t('adminMusicForge.inspectorContentId')}: {contentId}
								</p>
							) : null}
							{downloadUrl ? (
								<a
									href={downloadUrl}
									className="mt-2 inline-block text-sm text-[var(--admin-ui-accent)] underline"
									target="_blank"
									rel="noreferrer"
								>
									{t('adminMusicForge.inspectorDownload')}
								</a>
							) : null}
						</MusicForgeAdminInspectorSection>
					) : null}

					{lyrics ? (
						<MusicForgeAdminInspectorSection
							title={t('adminMusicForge.inspectorLyrics')}
							defaultOpen={detail.status === 'completed'}
						>
							<pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-[var(--admin-ui-fg-muted)]">
								{lyricsPreview}
							</pre>
							{lyricsLines.length > LYRICS_PREVIEW_LINES ? (
								<AdminButton
									variant="ghost"
									className="mt-2 py-1 text-xs"
									onClick={() => setLyricsExpanded((v) => !v)}
								>
									{lyricsExpanded
										? t('adminMusicForge.inspectorLyricsCollapse')
										: t('adminMusicForge.inspectorLyricsExpand')}
								</AdminButton>
							) : null}
						</MusicForgeAdminInspectorSection>
					) : null}

					<MusicForgeAdminInspectorSection
						title={t('adminMusicForge.inspectorSectionPipeline')}
						defaultOpen={
							detail.status === 'failed' || detail.status === 'running'
						}
						badge={
							<span className={adminUiMetaClass}>
								{stepsCount} {t('adminMusicForge.inspectorStepsCount')}
							</span>
						}
					>
						{runError ? (
							<div
								className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
								role="alert"
							>
								{t('adminMusicForge.inspectorRunError')}: {runError}
							</div>
						) : null}
						<ol className="space-y-2">
							{(detail.steps ?? []).map((step) => {
								const stepErr = errorMessage(asRecord(step.error_payload));
								return (
									<li
										key={`${step.step_index}-${step.step_kind}`}
										className="rounded-lg border border-[var(--admin-ui-border)]/60 bg-[var(--admin-ui-surface-strong)] px-3 py-2"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="text-sm text-[var(--admin-ui-fg)]">
												{step.step_index}. {step.title}
												<span className="ml-2 text-xs text-[var(--admin-ui-fg-dim)]">
													({step.step_kind})
												</span>
											</span>
											<MusicForgeAdminRunStatusBadge status={step.status} />
										</div>
										{stepErr ? (
											<p className="mt-1 text-xs text-red-200">{stepErr}</p>
										) : null}
									</li>
								);
							})}
						</ol>
						{stepsCount === 0 ? (
							<p className={adminUiMetaClass}>
								{t('adminMusicForge.inspectorStepsEmpty')}
							</p>
						) : null}
					</MusicForgeAdminInspectorSection>

					<MusicForgeAdminInspectorSection
						title={t('adminMusicForge.inspectorSectionMeta')}
						defaultOpen={false}
					>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.inspectorMode')}
								</p>
								<p className="text-sm">{strFrom(normalized, 'mode_key')}</p>
							</div>
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.runsLane')}
								</p>
								<p className="text-sm">{strFrom(normalized, 'model_lane')}</p>
							</div>
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.inspectorConfigVersion')}
								</p>
								<p className="text-sm">
									{detail.config_version ?? '—'}
									{detail.config_generation != null
										? ` · gen ${detail.config_generation}`
										: ''}
								</p>
							</div>
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.runsUser')}
								</p>
								<p className="font-mono text-xs">{detail.user_id}</p>
							</div>
							<div>
								<p className={adminUiMetaClass}>
									{t('adminMusicForge.runsDuration')}
								</p>
								<p className="text-sm">
									{formatMusicForgeAdminDuration(detail.duration_seconds)}
								</p>
							</div>
						</div>
					</MusicForgeAdminInspectorSection>

					<MusicForgeAdminInspectorSection
						title={t('adminMusicForge.inspectorSectionTechnical')}
						defaultOpen={false}
					>
						<pre className="max-h-64 overflow-auto rounded-lg border border-[var(--admin-ui-border)] bg-black/30 p-3 text-xs text-[var(--admin-ui-fg-muted)]">
							{JSON.stringify(
								{
									normalized_input: detail.normalized_input,
									song_blueprint: detail.song_blueprint,
									lyrics_payload: detail.lyrics_payload,
									style_capsule: detail.style_capsule,
									render_payload: detail.render_payload,
									result_payload: detail.result_payload,
									error_payload: detail.error_payload,
									config_revision_id: detail.config_revision_id,
								},
								null,
								2
							)}
						</pre>
					</MusicForgeAdminInspectorSection>

					{embedded ? (
						<div className="flex justify-end pt-1">
							<AdminButton variant="secondary" onClick={onClose}>
								{t('adminMusicForge.inspectorClose')}
							</AdminButton>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
