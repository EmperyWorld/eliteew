/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline authenticated media/text previews for Content Manager Pro.
 *
 * Invariants:
 * - Media is loaded through the authenticated content API and object URLs are revoked on cleanup.
 * - Text/blob preview requests are aborted on tab switches and stale results never update state.
 * - Markdown/HTML previews strip active content before rendering.
 *
 * Related:
 * - src/pages/ContentManager/ContentManagerPro.tsx
 */

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AuthenticatedAudioPreview } from '@/components/Audio/AuthenticatedAudioPreview';
import { RetryBlock } from '../../../components/ui/RetryBlock';
import { contentApi } from '../../../services/contentApi';
import { cn } from '../../../utils/cn';
import { DesktopAppSkeleton } from '../../Desktop/components/DesktopAppChrome';
import { requestEnqueueInMusicPlayer } from '../../Desktop/utils/desktopDeepLink';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';
import { sanitizeMarkdownHref } from '@/utils/markdownSecurity';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import {
	normalizeTextPreviewNewlines,
	resolveTextPreviewBodyKind,
	type TextPreviewBodyKind,
} from '../utils/contentManagerPreviewBody';

export const MediaPreview: React.FC<{
	contentId: string;
	/** Сброс кэша blob при том же id (updated_at + size после сохранения в редакторе). */
	contentRevision?: string;
	type: 'image' | 'video' | 'audio' | 'pdf';
	name: string;
}> = ({ contentId, contentRevision, type, name }) => {
	const { t } = useTranslation('contentManager');
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retryCount, setRetryCount] = useState(0);

	useEffect(() => {
		if (type === 'audio') {
			setLoading(false);
			setError(null);
			setBlobUrl(null);
			return;
		}
		setLoading(true);
		setError(null);
		setBlobUrl(null);
		void retryCount;
		let revoked = false;
		let currentUrl: string | null = null;
		const abortController = new AbortController();
		const fetchMedia = async () => {
			try {
				const { blob } = await contentApi.downloadContentBlob(
					contentId,
					contentRevision || null,
					{ signal: abortController.signal }
				);
				const url = URL.createObjectURL(blob);
				currentUrl = url;
				if (!revoked) setBlobUrl(url);
				else URL.revokeObjectURL(url);
			} catch (err: unknown) {
				if (abortController.signal.aborted) return;
				if (!revoked) {
					const status = (err as { response?: { status?: number } })?.response
						?.status;
					setError(
						status === 404 ? t('pro.media.notFound') : t('pro.media.loadFailed')
					);
				}
			} finally {
				if (!revoked) setLoading(false);
			}
		};
		void fetchMedia();
		return () => {
			revoked = true;
			abortController.abort();
			if (currentUrl) URL.revokeObjectURL(currentUrl);
		};
	}, [contentId, contentRevision, retryCount, t, type]);

	const handleRetry = useCallback(() => {
		setError(null);
		setLoading(true);
		setRetryCount((c) => c + 1);
	}, []);

	if (type !== 'audio' && loading)
		return (
			<div
				className="flex flex-col items-center justify-center gap-3 py-8"
				aria-busy="true"
			>
				<ArrowPathIcon
					className="h-6 w-6 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
				<DesktopAppSkeleton className="h-40 w-full max-w-lg rounded-(--desktop-radius-lg)" />
			</div>
		);
	if (type !== 'audio' && (error || !blobUrl))
		return (
			<RetryBlock
				message={error || t('pro.media.genericError')}
				onRetry={handleRetry}
				retryLabel={t('pro.media.retry')}
				className="my-4"
			/>
		);

	if (type === 'image')
		return (
			<img
				src={blobUrl ?? undefined}
				alt={name}
				className="max-w-full max-h-[50vh] mx-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) shadow-(--desktop-shadow-soft)"
			/>
		);
	if (type === 'video')
		return (
			<video
				src={blobUrl ?? undefined}
				controls
				className="max-w-full max-h-[50vh] mx-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) shadow-(--desktop-shadow-soft)"
			>
				<track kind="captions" srcLang="en" label="Captions" />
			</video>
		);
	if (type === 'audio') {
		return (
			<div className="flex flex-col items-center gap-4 py-6">
				<div className="w-16 h-16 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) flex items-center justify-center text-(--desktop-text-muted)">
					<MusicalNoteIcon className="w-8 h-8" />
				</div>
				<AuthenticatedAudioPreview
					contentId={contentId}
					contentVersion={contentRevision}
					trackName={name}
					sourceSurface="content-manager"
					showPlayInMusicPlayer
					className="w-full max-w-md"
				/>
				<button
					type="button"
					className="inline-flex rounded-md border border-(--desktop-border-subtle) px-2 py-1 text-xs text-(--desktop-text-primary) transition hover:bg-(--desktop-surface-soft-hover)"
					onClick={() => {
						requestEnqueueInMusicPlayer({
							id: contentId,
							name,
							version: contentRevision ?? null,
							source_surface: 'content-manager',
						});
					}}
				>
					{t('pro.preview.addToMusicQueue')}
				</button>
			</div>
		);
	}
	if (type === 'pdf')
		return (
			<div data-desktop-iframe-host="" className="h-[50vh] w-full">
				<iframe
					src={blobUrl ?? undefined}
					className="h-full w-full rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)"
					title={name}
				/>
			</div>
		);
	return null;
};

const TEXT_PREVIEW_MAX_CHARS = 50000;

const TEXT_PREVIEW_RICH_CLASS = cn(
	'prose prose-sm max-w-none min-w-0 break-words [word-break:break-word]',
	'text-(--desktop-text-secondary)',
	'prose-p:my-2 prose-p:first:mt-0 prose-p:last:mb-0',
	'prose-strong:text-(--desktop-text-primary) prose-strong:font-semibold',
	'prose-a:text-[rgb(var(--desktop-accent-rgb)/0.95)] prose-a:underline-offset-2',
	'prose-ul:my-2 prose-ol:my-2',
	'overflow-auto max-h-[50vh] rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-4'
);

function decodeTextFromArrayBuffer(
	buffer: ArrayBuffer,
	fileName: string | undefined
): { text: string; usedLegacyEncoding: boolean } {
	let offset = 0;
	if (buffer.byteLength >= 3) {
		const b0 = new Uint8Array(buffer)[0];
		const b1 = new Uint8Array(buffer)[1];
		const b2 = new Uint8Array(buffer)[2];
		if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
			offset = 3;
		}
	}
	const slice = offset > 0 ? buffer.slice(offset) : buffer;
	const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(slice);
	const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
	const looksLikeLegacyTxt =
		(fileName?.toLowerCase().endsWith('.txt') ?? false) &&
		utf8.length > 40 &&
		replacementCount / utf8.length > 0.008;
	let text = utf8;
	let usedLegacyEncoding = false;
	if (looksLikeLegacyTxt && typeof TextDecoder !== 'undefined') {
		try {
			const legacy = new TextDecoder('windows-1251', { fatal: false }).decode(
				slice
			);
			const legacyBad = (legacy.match(/\uFFFD/g) ?? []).length;
			if (legacyBad < replacementCount) {
				text = legacy;
				usedLegacyEncoding = true;
			}
		} catch {
			// ignore: environment may not register windows-1251
		}
	}
	return { text, usedLegacyEncoding };
}

export const TextPreview: React.FC<{
	contentId: string;
	contentRevision?: string;
	fileName?: string;
	mimeType?: string | null;
}> = ({ contentId, contentRevision, fileName, mimeType }) => {
	const { t } = useTranslation('contentManager');
	const [text, setText] = useState<string>('');
	const [bodyKind, setBodyKind] = useState<TextPreviewBodyKind>('plain');
	const [truncated, setTruncated] = useState(false);
	const [legacyNote, setLegacyNote] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retryCount, setRetryCount] = useState(0);

	useEffect(() => {
		setLoading(true);
		setError(null);
		void retryCount;
		let cancelled = false;
		const abortController = new AbortController();
		const fetchText = async () => {
			try {
				const { blob } = await contentApi.downloadContentBlob(
					contentId,
					contentRevision || null,
					{ signal: abortController.signal }
				);
				const buffer = await blob.arrayBuffer();
				if (cancelled || abortController.signal.aborted) return;
				const { text: decoded, usedLegacyEncoding } = decodeTextFromArrayBuffer(
					buffer,
					fileName
				);
				const decodedNorm = normalizeTextPreviewNewlines(decoded);
				setLegacyNote(usedLegacyEncoding);
				const over = decodedNorm.length > TEXT_PREVIEW_MAX_CHARS;
				setTruncated(over);
				const sliceText = over
					? decodedNorm.slice(0, TEXT_PREVIEW_MAX_CHARS)
					: decodedNorm;
				setText(sliceText);
				setBodyKind(
					resolveTextPreviewBodyKind(sliceText, fileName, mimeType ?? null)
				);
			} catch (err: unknown) {
				if (cancelled || abortController.signal.aborted) return;
				const status = (err as { response?: { status?: number } })?.response
					?.status;
				setError(
					status === 404
						? t('pro.media.notFound')
						: t('pro.media.loadContentFailed')
				);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void fetchText();
		return () => {
			cancelled = true;
			abortController.abort();
		};
	}, [contentId, contentRevision, retryCount, t, fileName, mimeType]);

	const handleRetry = useCallback(() => {
		setError(null);
		setLoading(true);
		setLegacyNote(false);
		setTruncated(false);
		setBodyKind('plain');
		setRetryCount((c) => c + 1);
	}, []);

	if (loading)
		return (
			<div
				className="flex flex-col items-center justify-center gap-3 py-8"
				aria-busy="true"
			>
				<ArrowPathIcon
					className="h-6 w-6 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
				<DesktopAppSkeleton className="h-48 w-full max-w-full rounded-(--desktop-radius-lg)" />
			</div>
		);
	if (error)
		return (
			<RetryBlock
				message={error}
				onRetry={handleRetry}
				retryLabel={t('pro.media.retry')}
				className="my-4"
			/>
		);

	return (
		<div className="space-y-2">
			{legacyNote ? (
				<p className="text-[11px] leading-snug text-(--desktop-text-dim)">
					{t('pro.media.encodingFallbackNote')}
				</p>
			) : null}
			{truncated ? (
				<p className="text-[11px] leading-snug text-(--desktop-text-dim)">
					{t('pro.media.textTruncatedNote', {
						max: TEXT_PREVIEW_MAX_CHARS,
					})}
				</p>
			) : null}
			{bodyKind === 'html' ? (
				<div
					className={TEXT_PREVIEW_RICH_CLASS}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML-фрагменты предпросмотра; sanitize-html.
					dangerouslySetInnerHTML={{
						__html: sanitizeUserHtml(text),
					}}
				/>
			) : bodyKind === 'markdown' ? (
				<div className={TEXT_PREVIEW_RICH_CLASS}>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeSanitize]}
						components={{
							a: ({ href, children }) => {
								const safeHref = sanitizeMarkdownHref(href);
								if (!safeHref) return <span>{children}</span>;
								return (
									<a href={safeHref} target="_blank" rel="noopener noreferrer">
										{children}
									</a>
								);
							},
						}}
					>
						{text}
					</ReactMarkdown>
				</div>
			) : (
				<pre className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-4 text-[13px] text-(--desktop-text-secondary) overflow-auto max-h-[50vh] whitespace-pre-wrap font-mono leading-relaxed">
					{text}
				</pre>
			)}
		</div>
	);
};
