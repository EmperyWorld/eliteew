/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Long-read Markdown renderer for Kursorina analytical reports: GFM, jammed-ATX
 * repair, explicit heading/list styles (no @tailwindcss/typography), Mermaid fences.
 *
 * Invariants:
 * - Untrusted HTML is sanitized (rehype-sanitize).
 * - Code fences are never rewritten by heading/table normalizers.
 * - Heading markers (###) must not appear as visible text after normalize+parse.
 * - Mermaid gantt → RoadmapTimeline; flowchart/graph → ProcessFlow;
 *   sequenceDiagram → SequenceFlow; other Mermaid uses presentation=document.
 * - SWOT / risk GFM tables → editorial SwotMatrix / RiskMatrix panels.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/KursorinaReportView.tsx
 * - shared/web/frontend/src/features/diagrams/roadmap/
 * - shared/web/frontend/src/features/diagrams/matrices/
 * - shared/web/frontend/src/features/ewa/companionChatMarkdownNormalize.ts
 * - shared/web/frontend/src/features/desktop-ai-chat/DesktopAiChatMarkdown.mermaid.tsx
 * - shared/web/frontend/src/features/desktop-ai-chat/DesktopAiChatMarkdown.media.tsx
 */

import { type ReactElement, type ReactNode, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import {
	languageFromClassName,
	textFromReactNode,
} from '@/features/desktop-ai-chat/DesktopAiChatMarkdown.components';
import {
	AuthenticatedContentDownloadImage,
	parseContentDownloadApiPath,
} from '@/features/desktop-ai-chat/DesktopAiChatMarkdown.media';
import {
	inferMermaidDiagramSource,
	MermaidFenceBlock,
} from '@/features/desktop-ai-chat/DesktopAiChatMarkdown.mermaid';
import {
	RiskMatrix,
	splitKursorinaReportParts,
	SwotMatrix,
} from '@/features/diagrams/matrices';
import { normalizeCompanionChatMarkdown } from '@/features/ewa/companionChatMarkdownNormalize';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { sanitizeMarkdownHref } from '@/utils/markdownSecurity';

const sanitizeSchema: typeof defaultSchema = {
	...defaultSchema,
	protocols: {
		...defaultSchema.protocols,
		href: [...(defaultSchema.protocols?.href ?? [])],
	},
};

const H1 = cn(
	'mb-3 mt-6 text-xl font-semibold tracking-tight text-(--desktop-text-primary) first:mt-0'
);
const H2 = cn(
	'mb-2.5 mt-5 border-b border-(--desktop-border-subtle) pb-2 text-lg font-semibold tracking-tight text-(--desktop-text-primary) first:mt-0'
);
const H3 = cn(
	'mb-2 mt-4 text-base font-semibold tracking-tight text-(--desktop-text-primary) first:mt-0'
);
const P = cn(
	DESKTOP_TYPOGRAPHY.body,
	'my-2.5 leading-[1.72] text-(--desktop-text-secondary) first:mt-0 last:mb-0'
);
const UL = cn(
	'my-3 list-disc space-y-1.5 pl-5 text-(--desktop-text-secondary)'
);
const OL = cn(
	'my-3 list-decimal space-y-1.5 pl-5 text-(--desktop-text-secondary) marker:font-semibold marker:text-[rgb(var(--desktop-accent-rgb)/0.7)]'
);
const LI = cn(
	'leading-[1.65] pl-0.5 marker:text-[rgb(var(--desktop-accent-rgb)/0.72)]'
);
const STRONG = 'font-semibold text-(--desktop-text-primary)';
const BLOCKQUOTE = cn(
	'my-3 rounded-r-(--desktop-radius) border-l-[3px] border-[rgb(var(--desktop-accent-rgb)/0.5)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,rgb(var(--desktop-bg-primary-rgb))_58%)]',
	'px-4 py-2.5 not-italic text-(--desktop-text-secondary)'
);
const HR =
	'my-6 border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)]';
const INLINE_CODE = cn(
	'rounded-md border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-1.5 py-px text-[0.88em] font-normal text-(--desktop-text-primary)'
);
const LINK = cn(
	'font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)] underline decoration-2 underline-offset-[3px]',
	'decoration-[rgb(var(--desktop-accent-rgb)/0.42)] hover:decoration-[rgb(var(--desktop-accent-rgb)/0.75)]'
);
const PRE_WRAP = cn(
	'my-3 max-h-[min(28rem,55vh)] overflow-auto rounded-(--desktop-radius)',
	'border border-(--desktop-border-subtle)',
	'bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.96)_100%)]',
	'p-3.5 font-mono text-[13px] leading-relaxed text-slate-200'
);
const TABLE_WRAP = cn(
	'my-4 max-w-full overflow-x-auto rounded-(--desktop-radius-lg)',
	'border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_22%,var(--desktop-surface-panel-strong)_78%)]',
	'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
);
const TH = cn(
	'sticky top-0 border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2',
	'text-left text-[0.8125rem] font-semibold text-(--desktop-text-primary)'
);
const TD = cn(
	'border border-(--desktop-border-subtle)/80 px-3 py-2 text-[0.8125rem] leading-snug text-(--desktop-text-secondary)'
);

function ReportCodeFence({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}): ReactElement {
	const raw = textFromReactNode(children).replace(/\n$/, '');
	const lang = languageFromClassName(className);
	const explicitMermaid = lang?.toLowerCase() === 'mermaid';
	const inferred = inferMermaidDiagramSource(raw);
	const mermaidSource = explicitMermaid ? raw : inferred;
	if (mermaidSource) {
		return <MermaidFenceBlock source={mermaidSource} presentation="document" />;
	}
	return (
		<pre className={PRE_WRAP}>
			<code className={lang ? `language-${lang}` : undefined}>{raw}</code>
		</pre>
	);
}

function ReportMarkdownBody({ body }: { body: string }): ReactElement {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
			components={{
				h1: ({ children }) => <h1 className={H1}>{children}</h1>,
				h2: ({ children }) => <h2 className={H2}>{children}</h2>,
				h3: ({ children }) => <h3 className={H3}>{children}</h3>,
				h4: ({ children }) => (
					<h4 className="mb-1.5 mt-3 text-sm font-semibold text-(--desktop-text-primary)">
						{children}
					</h4>
				),
				p: ({ children }) => <p className={P}>{children}</p>,
				ul: ({ children }) => <ul className={UL}>{children}</ul>,
				ol: ({ children }) => <ol className={OL}>{children}</ol>,
				li: ({ children }) => <li className={LI}>{children}</li>,
				strong: ({ children }) => (
					<strong className={STRONG}>{children}</strong>
				),
				blockquote: ({ children }) => (
					<blockquote className={BLOCKQUOTE}>{children}</blockquote>
				),
				hr: () => <hr className={HR} />,
				a: ({ href, children }) => {
					const h = sanitizeMarkdownHref(href);
					if (!h) {
						return (
							<span className="text-(--desktop-text-muted) underline decoration-dotted">
								{children}
							</span>
						);
					}
					return (
						<a
							href={h}
							target="_blank"
							rel="noopener noreferrer"
							className={LINK}
						>
							{children}
						</a>
					);
				},
				code: ({ className: codeClass, children, ...props }) => {
					const p = props as { inline?: boolean };
					if (p.inline === true) {
						return <code className={INLINE_CODE}>{children}</code>;
					}
					return (
						<ReportCodeFence className={codeClass}>{children}</ReportCodeFence>
					);
				},
				pre: ({ children }) => <>{children}</>,
				table: ({ children }) => (
					<div className={TABLE_WRAP}>
						<table className="mb-0 w-full min-w-full border-collapse">
							{children}
						</table>
					</div>
				),
				th: ({ children }) => <th className={TH}>{children}</th>,
				td: ({ children }) => <td className={TD}>{children}</td>,
				img: ({ src, alt }) => {
					const raw = typeof src === 'string' ? src.trim() : '';
					const apiPath = raw ? parseContentDownloadApiPath(raw) : null;
					if (apiPath) {
						return (
							<AuthenticatedContentDownloadImage
								apiPath={apiPath}
								alt={alt?.trim() || 'График'}
							/>
						);
					}
					return (
						<span
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'text-(--desktop-text-dim)'
							)}
						>
							[{alt?.trim() || 'image'}]
						</span>
					);
				},
			}}
		>
			{body}
		</ReactMarkdown>
	);
}

export type KursorinaReportMarkdownProps = {
	content: string;
	className?: string;
};

/**
 * Normalize + render a Kursorina product answer for the report tab.
 */
export function KursorinaReportMarkdown({
	content,
	className,
}: KursorinaReportMarkdownProps): ReactElement | null {
	const body = normalizeCompanionChatMarkdown(content);
	const parts = useMemo(
		() => (body ? splitKursorinaReportParts(body) : []),
		[body]
	);
	if (!body) return null;

	return (
		<div
			className={cn('kursorina-report-md min-w-0 break-words', className)}
			data-kursorina-report-markdown="1"
		>
			{parts.map((part) => {
				if (part.type === 'swot') {
					return (
						<SwotMatrix key={`swot:${part.data.title}`} data={part.data} />
					);
				}
				if (part.type === 'risk') {
					return (
						<RiskMatrix key={`risk:${part.data.title}`} data={part.data} />
					);
				}
				return (
					<ReportMarkdownBody
						key={`md:${part.text.slice(0, 48)}`}
						body={part.text}
					/>
				);
			})}
		</div>
	);
}
