/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render completed UGS task results (image/audio/text/JSON) in Hub result modal.
 *
 * Invariants:
 * - Raw JSON fallback only when `allowRawJson` (admin).
 * - Audio result preview passes localized placeholder WebVTT via `buildUgsHubAudioPlaceholderCaptionsVtt(t)`.
 *
 * Related:
 * - ugsHubResultParsing.ts, UgsHubUnifiedContentPreviews.tsx, ugsHubResultConstants.ts, ugsHubSharedUi.tsx
 */

import {
	ArrowDownTrayIcon,
	DocumentDuplicateIcon,
	PhotoIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { InlineAudioPreview } from '../../../Audio/InlineAudioPreview';
import type { UGSTask } from '../../../../hooks/api/useUgsDashboard';
import { apiClient } from '../../../../services/api/client';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubResultCaptionClasses,
	ugsHubResultCodePanelClasses,
	ugsHubResultCopyBtnClasses,
	ugsHubResultDownloadAccentClasses,
	ugsHubResultDownloadBtnClasses,
	ugsHubResultEmptyStateClasses,
	ugsHubResultMediaPanelClasses,
	ugsHubResultSectionTitleClasses,
	ugsHubTextMuted,
	ugsHubTextSecondary,
} from '../ugsHubSharedUi';
import { cn } from '../utils/ugsHubFormatting';
import {
	extractAudioInfo,
	extractImageInfo,
	extractTextFromResult,
	isAudioType,
	isImageType,
	isLikelyTextResultType,
} from './ugsHubResultParsing';
import { buildUgsHubAudioPlaceholderCaptionsVtt } from './ugsHubResultConstants';
import {
	UgsUnifiedContentAudioPreview,
	UgsUnifiedContentImagePreview,
} from './UgsHubUnifiedContentPreviews';

export const UgsHubResultContent: React.FC<{
	task: UGSTask;
	onCopy: (content: string) => void;
	/** When false, hide raw JSON fallback (non-admin users). */
	allowRawJson?: boolean;
}> = React.memo(
	({ task, onCopy, allowRawJson = true }) => {
		const { t, i18n } = useTranslation('ugsHub');
		const theme = useUgsHubShellTheme();
		const result = task.result;
		const typeKey = task.type_key;
		const textContent = extractTextFromResult(result);
		const resultRecord = result as Record<string, unknown> | undefined;
		const imageInfo = extractImageInfo(resultRecord);
		const audioInfo = extractAudioInfo(resultRecord);
		const audioCaptionsSrc = React.useMemo(
			() => buildUgsHubAudioPlaceholderCaptionsVtt(t),
			[t]
		);
		const audioCaptionsSrcLang = (i18n.language || 'en').split('-')[0] || 'en';
		const audioCaptionsLabel = t('result.captionsTrackLabel');

		if (imageInfo?.hasRenderable || isImageType(typeKey)) {
			return (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className={ugsHubResultSectionTitleClasses(theme)}>
							{t('result.imageTitle')}
						</h4>
						{(imageInfo?.src || imageInfo?.unifiedContentId) && (
							<button
								type="button"
								onClick={() => {
									void (async () => {
										if (imageInfo.unifiedContentId) {
											try {
												const { data } = await apiClient.get<Blob>(
													`/api/v1/content/${encodeURIComponent(imageInfo.unifiedContentId)}/download`,
													{ responseType: 'blob' }
												);
												const url = URL.createObjectURL(data);
												const link = document.createElement('a');
												link.href = url;
												link.download =
													imageInfo.filename || 'generated-image.png';
												link.click();
												URL.revokeObjectURL(url);
											} catch {
												// toast optional; keep silent like other branches
											}
											return;
										}
										const src = imageInfo.src;
										if (!src) {
											return;
										}
										const link = document.createElement('a');
										link.href = src;
										link.download = imageInfo.filename || 'generated-image.png';
										link.click();
									})();
								}}
								className={ugsHubResultDownloadAccentClasses(theme)}
							>
								<ArrowDownTrayIcon width={14} height={14} />
								{t('result.download')}
							</button>
						)}
					</div>
					<div className={ugsHubResultMediaPanelClasses(theme)}>
						{imageInfo?.hasRenderable &&
						(imageInfo.src || imageInfo.unifiedContentId) ? (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.3 }}
								className="relative group"
							>
								{imageInfo.unifiedContentId ? (
									<UgsUnifiedContentImagePreview
										contentId={imageInfo.unifiedContentId}
										alt={
											imageInfo.filename
												? t('result.imageAlt', {
														filename: imageInfo.filename,
													})
												: t('result.imageAltFallback')
										}
										className="w-full h-auto rounded-lg shadow-(--desktop-shadow-panel) transition-[box-shadow,border-color] duration-300 hover:shadow-(--desktop-shadow-soft)"
									/>
								) : (
									<img
										src={imageInfo.src ?? ''}
										alt={
											imageInfo.filename
												? t('result.imageAlt', {
														filename: imageInfo.filename,
													})
												: t('result.imageAltFallback')
										}
										className="w-full h-auto rounded-lg shadow-(--desktop-shadow-panel) transition-[box-shadow,border-color] duration-300 hover:shadow-(--desktop-shadow-soft)"
										onError={(e) => {
											const target = e.currentTarget as HTMLImageElement;
											target.style.display = 'none';
											const nextSibling =
												target.nextElementSibling as HTMLElement;
											if (nextSibling) {
												nextSibling.textContent = t('result.imageLoadError');
											}
										}}
									/>
								)}
								{imageInfo.filename && (
									<div className={ugsHubResultCaptionClasses(theme)}>
										{imageInfo.filename}
									</div>
								)}
							</motion.div>
						) : (
							<div className={ugsHubResultEmptyStateClasses(theme)}>
								<PhotoIcon
									className={cn(
										'mx-auto mb-4 h-16 w-16',
										ugsHubTextMuted(theme)
									)}
								/>
								<p>{t('result.imageMissing')}</p>
							</div>
						)}
					</div>
				</div>
			);
		}

		if (audioInfo?.hasRenderable || isAudioType(typeKey)) {
			return (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className={ugsHubResultSectionTitleClasses(theme)}>
							{t('result.audioTitle')}
						</h4>
						{(audioInfo?.src || audioInfo?.unifiedContentId) && (
							<button
								type="button"
								onClick={() => {
									void (async () => {
										if (audioInfo.unifiedContentId) {
											try {
												const { data } = await apiClient.get<Blob>(
													`/api/v1/content/${encodeURIComponent(audioInfo.unifiedContentId)}/download`,
													{ responseType: 'blob' }
												);
												const url = URL.createObjectURL(data);
												const link = document.createElement('a');
												link.href = url;
												link.download = audioInfo.filename || 'generated-audio';
												link.click();
												URL.revokeObjectURL(url);
											} catch {
												// ignore
											}
											return;
										}
										const src = audioInfo.src;
										if (!src) {
											return;
										}
										const link = document.createElement('a');
										link.href = src;
										link.download = audioInfo.filename || 'generated-audio';
										link.click();
									})();
								}}
								className={ugsHubResultDownloadBtnClasses(theme)}
							>
								<ArrowDownTrayIcon width={14} height={14} />
								{t('result.download')}
							</button>
						)}
					</div>
					<div className={ugsHubResultMediaPanelClasses(theme)}>
						{audioInfo?.src || audioInfo?.unifiedContentId ? (
							<figure className="space-y-2">
								{audioInfo.unifiedContentId ? (
									<UgsUnifiedContentAudioPreview
										contentId={audioInfo.unifiedContentId}
										mime={audioInfo.mime || 'audio/mpeg'}
										captionsSrc={audioCaptionsSrc}
										captionsSrcLang={audioCaptionsSrcLang}
										captionsLabel={audioCaptionsLabel}
									/>
								) : (
									<InlineAudioPreview
										src={audioInfo.src ?? ''}
										mimeType={audioInfo.mime || 'audio/mpeg'}
										trackName={audioInfo.filename ?? 'UGS audio'}
										captionsSrc={audioCaptionsSrc}
										captionsSrcLang={audioCaptionsSrcLang}
										captionsLabel={audioCaptionsLabel}
										className="w-full"
									/>
								)}
								<figcaption className={ugsHubResultCaptionClasses(theme)}>
									{t('result.audioCaption')}
								</figcaption>
							</figure>
						) : (
							<div className={ugsHubResultEmptyStateClasses(theme)}>
								{t('result.audioMissing')}
							</div>
						)}
					</div>
				</div>
			);
		}

		if (textContent || isLikelyTextResultType(typeKey)) {
			const content =
				textContent ??
				(!allowRawJson
					? t('result.textUnavailable')
					: JSON.stringify(result, null, 2));
			return (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className={ugsHubResultSectionTitleClasses(theme)}>
							{t('result.textTitle')}
						</h4>
						<button
							type="button"
							onClick={() => onCopy(String(content))}
							className={ugsHubResultCopyBtnClasses(theme)}
						>
							<DocumentDuplicateIcon width={14} height={14} />
							<span>{t('result.copy')}</span>
						</button>
					</div>
					<div className={ugsHubResultMediaPanelClasses(theme)}>
						<pre className={ugsHubResultCodePanelClasses(theme)}>
							{String(content)}
						</pre>
					</div>
					{(() => {
						const tokensUsed = resultRecord?.tokens_used;
						return tokensUsed && typeof tokensUsed === 'number' ? (
							<div className={cn('text-sm', ugsHubTextSecondary(theme))}>
								{t('result.tokensUsed', { count: tokensUsed })}
							</div>
						) : null;
					})()}
				</div>
			);
		}

		if (!allowRawJson) {
			return (
				<div className={ugsHubResultMediaPanelClasses(theme)}>
					<p
						className={cn(
							'text-sm leading-relaxed',
							ugsHubTextSecondary(theme)
						)}
					>
						{t('result.nonAdminReady')}
					</p>
				</div>
			);
		}

		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h4 className={ugsHubResultSectionTitleClasses(theme)}>
						{t('result.jsonTitle')}
					</h4>
					<button
						type="button"
						onClick={() => onCopy(JSON.stringify(result, null, 2))}
						className={ugsHubResultCopyBtnClasses(theme)}
					>
						<DocumentDuplicateIcon width={14} height={14} />
						<span>{t('result.copyJson')}</span>
					</button>
				</div>
				<div className={ugsHubResultMediaPanelClasses(theme)}>
					<pre className={ugsHubResultCodePanelClasses(theme)}>
						{JSON.stringify(result, null, 2)}
					</pre>
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.task.id === nextProps.task.id &&
			prevProps.task.result === nextProps.task.result &&
			prevProps.task.type_key === nextProps.task.type_key &&
			prevProps.allowRawJson === nextProps.allowRawJson
		);
	}
);

UgsHubResultContent.displayName = 'UgsHubResultContent';
