/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Facade for safe Desktop AI Chat markdown (GFM, tables, Mermaid, code, images).
 * Domains: prose tokens, media security, Mermaid, ReactMarkdown component overrides.
 *
 * Invariants:
 * - Untrusted hosts must not become <img src>; content download uses apiClient Bearer.
 * - Mermaid SVG is cached so parent remounts do not re-run mermaid.render.
 * - Gemma channel-thought markup is stripped before render.
 *
 * Related:
 * - DesktopAiChatMarkdown.{prose,media,mermaid,components}.*
 * - desktopAiChatMermaidCache.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { buildSharedChatRehypePlugins } from '@/components/assistantMessage/sharedChatRehypePlugins';
import { assistantReplyDisplayParts } from '@/components/assistantMessage/assistantReplySanitize';
import { stripCompanionChannelMarkup } from '@/features/ewa/companionVisibleReplySanitize';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';

import {
	ChatMarkdownTable,
	MarkdownCodeBlockPre,
	normalizeJammedAtxHeadings,
} from './DesktopAiChatMarkdown.components';
import {
	AuthenticatedContentDownloadImage,
	ChatMarkdownExternalImageLink,
	isTrustedChatImageUrl,
	parseContentDownloadApiPath,
	safeHref,
} from './DesktopAiChatMarkdown.media';
import { humanizeDesktopAiCitationMarkers } from './desktopAiEvidence';
import type { DesktopAiContextSource } from './api/desktopChatClient';
import {
	chatMarkdownRootClass,
	rehypeAutolinkChatOptionsBase,
	type DesktopAiMarkdownPresentation,
} from './DesktopAiChatMarkdown.prose';

export {
	isTrustedChatImageUrl,
	parseContentDownloadApiPath,
} from './DesktopAiChatMarkdown.media';
export type { DesktopAiMarkdownPresentation } from './DesktopAiChatMarkdown.prose';

export const DesktopAiChatMarkdown = React.memo(function DesktopAiChatMarkdown({
	markdown,
	ensembleBodyTint,
	presentation = 'chat',
	citationSources,
}: {
	markdown: string;
	/** Hex для `color-mix` с `--desktop-text-secondary` (режим «Команда»). */
	ensembleBodyTint?: string;
	/** Professional-document mode increases reading rhythm and adds code line numbers. */
	presentation?: DesktopAiMarkdownPresentation;
	/** When set, 【P1】/【D2】 markers become readable «kind: title» in the body. */
	citationSources?: DesktopAiContextSource[];
}) {
	const { t } = useTranslation('desktopAiChat');
	const shellTheme = useDesktopShellTheme();
	const rehypePlugins = React.useMemo(
		() =>
			buildSharedChatRehypePlugins([
				rehypeSlug,
				[
					rehypeAutolinkHeadings,
					{
						...rehypeAutolinkChatOptionsBase,
						properties: {
							...rehypeAutolinkChatOptionsBase.properties,
							ariaLabel: t('headingSectionLink'),
						},
					},
				],
			]),
		[t]
	);

	const markdownComponents = React.useMemo(
		() => ({
			a: ({ href, children, ...rest }: React.ComponentPropsWithoutRef<'a'>) => {
				const raw = typeof href === 'string' ? href.trim() : '';
				if (!raw) return <span {...rest}>{children}</span>;
				if (raw.startsWith('#')) {
					return (
						<a href={raw} {...rest}>
							{children}
						</a>
					);
				}
				const h = safeHref(raw);
				if (!h) return <span {...rest}>{children}</span>;
				return (
					<a href={h} target="_blank" rel="noopener noreferrer" {...rest}>
						{children}
					</a>
				);
			},
			img: ({ alt, src }: React.ComponentPropsWithoutRef<'img'>) => {
				const s = typeof src === 'string' ? src : '';
				if (!isTrustedChatImageUrl(s)) {
					return (
						<span className={DESKTOP_TYPOGRAPHY.small}>
							[{alt?.trim() || 'image'}]
						</span>
					);
				}
				const apiPath = parseContentDownloadApiPath(s);
				if (apiPath) {
					return (
						<AuthenticatedContentDownloadImage
							apiPath={apiPath}
							alt={alt?.trim() || ''}
						/>
					);
				}
				return (
					<ChatMarkdownExternalImageLink href={s} alt={alt?.trim() || ''} />
				);
			},
			table: ({
				children,
				className,
				...rest
			}: React.ComponentPropsWithoutRef<'table'>) => (
				<ChatMarkdownTable
					{...rest}
					className={className}
					presentation={presentation}
				>
					{children}
				</ChatMarkdownTable>
			),
			pre: (props: React.ComponentPropsWithoutRef<'pre'>) => (
				<MarkdownCodeBlockPre {...props} presentation={presentation} />
			),
			code: ({
				className,
				children,
				...rest
			}: React.ComponentPropsWithoutRef<'code'>) => (
				<code className={className} {...rest}>
					{children}
				</code>
			),
		}),
		[presentation]
	);

	if (!markdown.trim()) {
		return null;
	}
	const visibleMarkdown =
		citationSources && citationSources.length > 0
			? humanizeDesktopAiCitationMarkers(markdown, citationSources)
			: markdown;
	const md = normalizeJammedAtxHeadings(
		assistantReplyDisplayParts(stripCompanionChannelMarkup(visibleMarkdown))
			.bubbleMarkdown
	);

	return (
		<div
			data-markdown-presentation={presentation}
			className={chatMarkdownRootClass(
				ensembleBodyTint,
				shellTheme,
				presentation
			)}
			style={
				ensembleBodyTint
					? ({
							'--bubble-mix-tint': ensembleBodyTint,
						} as React.CSSProperties)
					: undefined
			}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={rehypePlugins}
				components={markdownComponents}
			>
				{md}
			</ReactMarkdown>
		</div>
	);
});
