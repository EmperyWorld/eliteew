/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ReactMarkdown table/code overrides and ATX heading normalization for Desktop AI Chat.
 *
 * Invariants:
 * - Document tables use table-fixed wrap; code fences may delegate to MermaidFenceBlock.
 *
 * Related:
 * - DesktopAiChatMarkdown.tsx (facade)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import { toast } from 'sonner';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

import { CodeBlock } from '@/components/CodeBlock';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { cn } from '@/utils/cn';

import type { DesktopAiMarkdownPresentation } from './DesktopAiChatMarkdown.prose';
import {
	inferMermaidDiagramSource,
	MermaidFenceBlock,
} from './DesktopAiChatMarkdown.mermaid';

export function ChatMarkdownTable({
	children,
	className,
	presentation,
	...rest
}: React.ComponentPropsWithoutRef<'table'> & {
	presentation: DesktopAiMarkdownPresentation;
}) {
	const shellTheme = useDesktopShellTheme();
	const isDocument = presentation === 'document';
	const theadOpaque =
		shellTheme === 'light'
			? '[&_thead_th]:bg-(--desktop-surface-soft)'
			: '[&_thead_th]:bg-[color-mix(in_srgb,var(--glass-bg-strong)_88%,rgb(var(--desktop-bg-primary-rgb))_12%)]';

	return (
		<div
			className={cn(
				'my-2.5 min-w-0 max-w-full overflow-x-auto rounded-lg border shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]',
				isDocument && 'my-3',
				shellTheme === 'light'
					? 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) [&_tbody>tr:nth-child(even)]:bg-black/3'
					: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_58%,rgb(var(--desktop-bg-primary-rgb))_42%)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] [&_tbody>tr:nth-child(even)]:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)]'
			)}
		>
			<table
				{...rest}
				className={cn(
					'mb-0 w-full border-collapse text-left',
					// Fixed layout + max-w-0 cells force wrap inside columns instead of crushing
					// into an unreadable single line; scroll container still catches wide grids.
					isDocument
						? 'min-w-full table-fixed text-[0.8125rem] leading-snug'
						: 'min-w-[28rem] table-auto text-xs leading-snug',
					'[&_th]:align-top [&_td]:align-top',
					'[&_th]:break-words [&_td]:break-words [overflow-wrap:anywhere]',
					'[&_th]:whitespace-normal [&_td]:whitespace-normal',
					'[&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
					'[&_th]:font-semibold [&_th]:text-(--desktop-text-primary)',
					'[&_td]:text-(--desktop-text-secondary)',
					isDocument &&
						'[&_th]:max-w-0 [&_td]:max-w-0 [&_th:first-child]:w-[22%] [&_td:first-child]:w-[22%] [&_td:first-child]:font-medium [&_td:first-child]:text-(--desktop-text-primary)',
					isDocument && '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-1',
					isDocument && theadOpaque,
					className
				)}
			>
				{children}
			</table>
		</div>
	);
}

export function textFromReactNode(node: React.ReactNode): string {
	if (node == null || typeof node === 'boolean') return '';
	if (typeof node === 'string' || typeof node === 'number') return String(node);
	if (Array.isArray(node)) return node.map(textFromReactNode).join('');
	if (React.isValidElement(node)) {
		const { children: elChildren } = node.props as {
			children?: React.ReactNode;
		};
		return textFromReactNode(elChildren ?? null);
	}
	return '';
}

export function languageFromClassName(
	className: string | undefined
): string | null {
	if (!className) return null;
	const m = /language-([\w+-]+)/.exec(className);
	return m ? m[1] : null;
}
/**
 * Модель часто выдаёт ATX-заголовок слитно: «Постановка и цели # Раздел» без `\n` —
 * remark не строит заголовок, текст слепляется в один поток. Дробим только вне ```…```.
 */
export function normalizeJammedAtxHeadings(markdown: string): string {
	const parts = markdown.split(/(```[\s\S]*?```)/g);
	return parts
		.map((chunk, idx) => {
			if (idx % 2 === 1) {
				return chunk;
			}
			let s = chunk;
			for (let n = 0; n < 16; n++) {
				const next = s.replace(
					/(.+?)(\s+)(#{1,6}\s+\S[^\n#]*)/g,
					(_m, pre: string, sp: string, heading: string) => {
						if (pre.includes('\n') || /#\s*$/.test(pre)) {
							return `${pre}${sp}${heading}`;
						}
						if (/(?:\/\/|\[)/.test(pre.slice(-12))) {
							return `${pre}${sp}${heading}`;
						}
						return `${pre.trimEnd()}\n\n${heading}`;
					}
				);
				if (next === s) {
					break;
				}
				s = next;
			}
			return s;
		})
		.join('');
}
export function MarkdownCodeBlockPre({
	children,
	className,
	presentation,
	...rest
}: React.ComponentPropsWithoutRef<'pre'> & {
	presentation: DesktopAiMarkdownPresentation;
}) {
	const { t } = useTranslation('desktopAiChat');
	const shellTheme = useDesktopShellTheme();
	const [copied, setCopied] = React.useState(false);
	const raw = textFromReactNode(children).replace(/\n$/, '');
	let langLabel: string | null = null;
	for (const ch of React.Children.toArray(children)) {
		if (!React.isValidElement(ch)) continue;
		const cls = (ch.props as { className?: string }).className;
		const fromCls = languageFromClassName(cls);
		if (fromCls) {
			langLabel = fromCls;
			break;
		}
	}

	const explicitMermaid = langLabel?.toLowerCase() === 'mermaid';
	const inferredDiagram = inferMermaidDiagramSource(raw);
	const mermaidDiagramSource = explicitMermaid ? raw : inferredDiagram;

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(raw);
			setCopied(true);
			toast.success(t('codeCopiedToast'));
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			toast.error(t('codeCopyFailedToast'));
		}
	};

	if (mermaidDiagramSource) {
		return <MermaidFenceBlock source={mermaidDiagramSource} />;
	}

	return (
		<div
			className={cn(
				'my-2.5 min-w-0 max-w-full rounded-lg border overflow-hidden',
				shellTheme === 'light'
					? 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-[0_6px_24px_rgba(0,0,0,0.08)]'
					: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_72%,rgb(var(--desktop-bg-primary-rgb))_28%)] shadow-[0_8px_28px_rgba(0,0,0,0.26)]'
			)}
		>
			<div
				className={cn(
					'flex items-center justify-between gap-2 border-b px-2.5 py-1.5',
					shellTheme === 'light'
						? 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
						: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_48%,rgb(var(--desktop-bg-primary-rgb))_52%)]'
				)}
			>
				<span
					className={cn(
						'truncate font-medium uppercase tracking-wide text-(--desktop-text-dim)',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
				>
					{langLabel || t('codeLanguageFallback')}
				</span>
				<button
					type="button"
					onClick={() => void onCopy()}
					className={cn(
						'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-(--desktop-text-secondary)',
						DESKTOP_TYPOGRAPHY.captionInherit,
						shellTheme === 'light'
							? 'border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
							: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] hover:text-(--desktop-text-primary)',
						DESKTOP_INTERACTIVE.btnRounded
					)}
					aria-label={copied ? t('copyCodeDone') : t('copyCode')}
					aria-pressed={copied}
				>
					{copied ? (
						<CheckIcon
							className="h-3.5 w-3.5 shrink-0 text-emerald-400"
							aria-hidden
						/>
					) : (
						<DocumentDuplicateIcon
							className="h-3.5 w-3.5 shrink-0"
							aria-hidden
						/>
					)}
					{copied ? t('copyCodeDone') : t('copyCode')}
				</button>
			</div>
			{presentation === 'document' ? (
				<CodeBlock
					language={langLabel || 'text'}
					code={raw}
					showLineNumbers={raw.includes('\n')}
					themeVariant="desktop-chat"
					className="rounded-none"
				/>
			) : (
				<pre
					{...rest}
					className={cn(
						'overflow-x-auto p-3 leading-[1.6] text-(--desktop-text-primary)',
						DESKTOP_TYPOGRAPHY.shellCopy13,
						className
					)}
				>
					{children}
				</pre>
			)}
		</div>
	);
}
