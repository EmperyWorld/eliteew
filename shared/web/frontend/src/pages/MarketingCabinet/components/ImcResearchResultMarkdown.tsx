/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders sanitized Markdown for IMC research results in the Marketing Cabinet.
 *
 * Invariants:
 * - Model/research Markdown never enables raw HTML execution.
 * - Links are inert unless they pass the shared absolute `http/https` guard.
 *
 * Related:
 * - src/utils/markdownSecurity.ts
 */
import { cn } from '@/utils/cn';
import { sanitizeMarkdownHref } from '@/utils/markdownSecurity';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

const PROSE_BASE =
	cn(
		'prose prose-invert max-w-none leading-[1.65] break-words [word-break:break-word]',
		DESKTOP_TYPOGRAPHY.body
	) +
	' ' +
	'prose-headings:scroll-mt-4 prose-headings:text-(--desktop-text-primary) prose-headings:font-semibold prose-headings:tracking-tight ' +
	'prose-h1:mb-3 prose-h1:mt-8 prose-h1:text-xl prose-h1:first:mt-0 ' +
	'prose-h2:mb-2 prose-h2:mt-7 prose-h2:border-b prose-h2:border-(--desktop-border-subtle) prose-h2:pb-2 prose-h2:text-lg prose-h2:first:mt-0 ' +
	'prose-h3:mb-1.5 prose-h3:mt-5 prose-h3:text-base prose-h3:first:mt-0 ' +
	'prose-h4:mb-1 prose-h4:mt-4 prose-h4:text-sm prose-h4:first:mt-0 ' +
	'prose-p:my-3 prose-p:text-(--desktop-text-secondary) ' +
	'prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:text-(--desktop-text-secondary) ' +
	'prose-strong:text-(--desktop-text-primary) prose-strong:font-semibold ' +
	'prose-code:rounded prose-code:bg-(--desktop-surface-soft) prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:font-normal prose-code:text-(--mc-accent) prose-code:before:content-none prose-code:after:content-none ' +
	'prose-a:text-(--mc-accent) prose-a:underline-offset-2 prose-a:decoration-(--mc-accent)/50 hover:prose-a:decoration-(--mc-accent) ' +
	'prose-blockquote:my-4 prose-blockquote:border-l-2 prose-blockquote:border-(--mc-accent-40) prose-blockquote:bg-(--desktop-surface-soft)/60 prose-blockquote:py-2 prose-blockquote:pl-4 prose-blockquote:pr-3 prose-blockquote:not-italic prose-blockquote:text-(--desktop-text-secondary) ' +
	'prose-hr:my-8 prose-hr:border-(--desktop-border-subtle) ' +
	'prose-table:my-0 prose-table:w-full prose-table:border-collapse prose-table:text-sm ' +
	'prose-th:border prose-th:border-(--desktop-border-subtle) prose-th:bg-(--desktop-surface-soft) prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-(--desktop-text-primary) ' +
	'prose-td:border prose-td:border-(--desktop-border-subtle) prose-td:px-3 prose-td:py-2 prose-td:text-(--desktop-text-secondary) ' +
	'prose-pre:my-4 prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-[13px] prose-pre:leading-relaxed';

export function ImcResearchResultMarkdown({ markdown }: { markdown: string }) {
	return (
		<div className={PROSE_BASE}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeSanitize]}
				components={{
					a: ({ href, children, ...rest }) => {
						const h = sanitizeMarkdownHref(href);
						if (!h) return <span {...rest}>{children}</span>;
						return (
							<a href={h} target="_blank" rel="noopener noreferrer" {...rest}>
								{children}
							</a>
						);
					},
					img: ({ alt }) => (
						<span className="text-xs text-(--desktop-text-dim)">
							[{alt?.trim() || 'image'}]
						</span>
					),
					table: ({ children, className, ...rest }) => (
						<div className="my-5 overflow-x-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30">
							<table {...rest} className={cn('mb-0 min-w-full', className)}>
								{children}
							</table>
						</div>
					),
					pre: ({ children, className, ...rest }) => (
						<pre
							{...rest}
							className={cn(
								'overflow-x-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3.5 sm:p-4',
								className
							)}
						>
							{children}
						</pre>
					),
				}}
			>
				{markdown}
			</ReactMarkdown>
		</div>
	);
}
