/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prose/presentation tokens for Desktop AI Chat markdown bubbles and documents.
 *
 * Invariants:
 * - Presentation changes reading rhythm only; security policy lives in media + main components map.
 *
 * Related:
 * - DesktopAiChatMarkdown.tsx (facade)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

/** Рамка вокруг картинки: по ширине контента, не на всю колонку (`w-fit`), без горизонтального вылезания. */
export const CHAT_MARKDOWN_IMG_FRAME =
	'my-2.5 block w-fit max-w-full min-w-0 rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_40%,rgb(var(--desktop-bg-primary-rgb))_60%)] p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]';
export const CHAT_MARKDOWN_IMG_CLASS =
	'max-h-72 w-auto max-w-full min-w-0 rounded-md object-contain';

/** Якоря заголовков (rehype-autolink-headings). Символ `#` в чате не показываем — ссылка остаётся для a11y. */
const CHAT_MD_HEADING_ANCHOR_MARK = 'hidden';

export const rehypeAutolinkChatOptionsBase = {
	behavior: 'append' as const,
	properties: {
		className: ['chat-md-heading-anchor'],
	},
	content: {
		type: 'element' as const,
		tagName: 'span',
		properties: {
			className: ['chat-md-heading-anchor-mark', CHAT_MD_HEADING_ANCHOR_MARK],
		},
		children: [{ type: 'text' as const, value: '#' }],
	},
};

/**
 * Тёмная тема: без `prose-invert` и сырого violet — цвета из `--desktop-*` и акцент,
 * как в {@link PROSE_BUBBLE_BASE_LIGHT}, чтобы совпадать с окном и светлой темой.
 */
const PROSE_BUBBLE_BASE = cn(
	'prose prose-sm max-w-none min-w-0 leading-[1.65] break-words [word-break:break-word]',
	DESKTOP_TYPOGRAPHY.body,
	'prose-headings:scroll-mt-3 prose-headings:text-(--desktop-text-primary) prose-headings:font-semibold ',
	'prose-headings:relative prose-headings:group/heading ',
	'prose-h1:mb-2 prose-h1:mt-4 prose-h1:text-lg prose-h1:first:mt-0 ',
	'prose-h2:mb-1.5 prose-h2:mt-3 prose-h2:text-base prose-h2:first:mt-0 ',
	'prose-h3:mb-1 prose-h3:mt-2 prose-h3:text-sm prose-h3:first:mt-0 ',
	'prose-strong:text-(--desktop-text-primary) prose-strong:font-semibold ',
	'prose-code:rounded-md prose-code:border prose-code:border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] prose-code:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,rgb(var(--desktop-bg-primary-rgb))_42%)] prose-code:px-1.5 prose-code:py-px prose-code:text-[0.88em] prose-code:font-normal prose-code:text-[color-mix(in_srgb,var(--desktop-text-primary)_85%,rgb(var(--desktop-accent-rgb))_15%)] prose-code:before:content-none prose-code:after:content-none ',
	'prose-a:text-[rgb(var(--desktop-accent-rgb)/0.95)] prose-a:underline-offset-2 prose-a:decoration-[rgb(var(--desktop-accent-rgb)/0.38)] hover:prose-a:text-[rgb(var(--desktop-accent-rgb))] prose-a:break-words ',
	'[&_a.chat-md-heading-anchor]:inline-flex [&_a.chat-md-heading-anchor]:items-baseline [&_a.chat-md-heading-anchor]:no-underline [&_a.chat-md-heading-anchor]:font-normal ',
	'[&_a.chat-md-heading-anchor]:text-(--desktop-text-dim) hover:[&_a.chat-md-heading-anchor]:text-[rgb(var(--desktop-accent-rgb))]/88 ',
	'prose-blockquote:my-2.5 prose-blockquote:border-l-[3px] prose-blockquote:border-[rgb(var(--desktop-accent-rgb)/0.45)] prose-blockquote:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_52%,rgb(var(--desktop-bg-primary-rgb))_48%)] prose-blockquote:py-2.5 prose-blockquote:pl-3.5 prose-blockquote:pr-3 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ',
	'prose-hr:my-5 prose-hr:border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] ',
	'prose-table:my-0 prose-table:w-full prose-table:border-collapse prose-table:text-xs ',
	'prose-li:marker:text-(--desktop-text-muted) ',
	'prose-th:border prose-th:border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] prose-th:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold prose-th:text-(--desktop-text-primary) ',
	'prose-td:border prose-td:border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] prose-td:px-2 prose-td:py-1 ',
	'[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_ul.contains-task-list]:my-2 ',
	'[&_li.task-list-item]:relative [&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2 [&_li.task-list-item]:my-1 [&_li.task-list-item]:pl-0 ',
	'[&_li.task-list-item>input]:pointer-events-none [&_li.task-list-item>input]:mt-0.5 [&_li.task-list-item>input]:h-3.5 [&_li.task-list-item>input]:w-3.5 [&_li.task-list-item>input]:shrink-0 [&_li.task-list-item>input]:accent-[rgb(var(--desktop-accent-rgb))] ',
	'prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-xs prose-pre:leading-relaxed'
);

/** Без `prose-invert`: на светлой оболочке десктопа текст остаётся тёмным. */
const PROSE_BUBBLE_BASE_LIGHT = cn(
	'prose prose-sm max-w-none min-w-0 leading-[1.65] break-words [word-break:break-word]',
	DESKTOP_TYPOGRAPHY.body,
	'prose-headings:scroll-mt-3 prose-headings:text-(--desktop-text-primary) prose-headings:font-semibold ',
	'prose-headings:relative prose-headings:group/heading ',
	'prose-h1:mb-2 prose-h1:mt-4 prose-h1:text-lg prose-h1:first:mt-0 ',
	'prose-h2:mb-1.5 prose-h2:mt-3 prose-h2:text-base prose-h2:first:mt-0 ',
	'prose-h3:mb-1 prose-h3:mt-2 prose-h3:text-sm prose-h3:first:mt-0 ',
	'prose-strong:text-(--desktop-text-primary) prose-strong:font-semibold ',
	'prose-code:rounded-md prose-code:border prose-code:border-(--desktop-border-subtle) prose-code:bg-(--desktop-surface-soft) prose-code:px-1.5 prose-code:py-px prose-code:text-[0.88em] prose-code:font-normal prose-code:text-[rgb(var(--desktop-accent-rgb))] prose-code:before:content-none prose-code:after:content-none ',
	'prose-a:text-[rgb(var(--desktop-accent-rgb))] prose-a:underline-offset-2 prose-a:decoration-[rgb(var(--desktop-accent-rgb)/0.35)] hover:prose-a:text-[rgb(var(--desktop-accent-rgb))]/85 prose-a:break-words ',
	'[&_a.chat-md-heading-anchor]:inline-flex [&_a.chat-md-heading-anchor]:items-baseline [&_a.chat-md-heading-anchor]:no-underline [&_a.chat-md-heading-anchor]:font-normal ',
	'[&_a.chat-md-heading-anchor]:text-(--desktop-text-dim) hover:[&_a.chat-md-heading-anchor]:text-[rgb(var(--desktop-accent-rgb))]/80 ',
	'prose-blockquote:my-2.5 prose-blockquote:border-l-[3px] prose-blockquote:border-[rgb(var(--desktop-accent-rgb)/0.45)] prose-blockquote:bg-(--desktop-surface-soft) prose-blockquote:py-2.5 prose-blockquote:pl-3.5 prose-blockquote:pr-3 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)] ',
	'prose-hr:my-5 prose-hr:border-(--desktop-border-subtle) ',
	'prose-table:my-0 prose-table:w-full prose-table:border-collapse prose-table:text-xs ',
	'prose-li:marker:text-(--desktop-text-muted) ',
	'prose-th:border prose-th:border-(--desktop-border-subtle) prose-th:bg-(--desktop-surface-soft) prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold prose-th:text-(--desktop-text-primary) ',
	'prose-td:border prose-td:border-(--desktop-border-subtle) prose-td:px-2 prose-td:py-1 ',
	'[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_ul.contains-task-list]:my-2 ',
	'[&_li.task-list-item]:relative [&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-2 [&_li.task-list-item]:my-1 [&_li.task-list-item]:pl-0 ',
	'[&_li.task-list-item>input]:pointer-events-none [&_li.task-list-item>input]:mt-0.5 [&_li.task-list-item>input]:h-3.5 [&_li.task-list-item>input]:w-3.5 [&_li.task-list-item>input]:shrink-0 [&_li.task-list-item>input]:accent-[rgb(var(--desktop-accent-rgb))] ',
	'prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-pre:text-xs prose-pre:leading-relaxed'
);

const PROSE_BUBBLE_BODY_DEFAULT = cn(
	'prose-p:my-2.5 prose-p:text-(--desktop-text-secondary) prose-p:leading-[1.65] ',
	'prose-ul:my-2.5 prose-ol:my-2.5 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-1 prose-li:text-(--desktop-text-secondary) prose-li:leading-[1.65] ',
	'prose-blockquote:text-(--desktop-text-secondary) ',
	'prose-td:text-(--desktop-text-secondary) '
);

/** Групповой чат: лёгкий оттенок через `--bubble-mix-tint` на корневом `div`. */
const PROSE_BUBBLE_BODY_ENSEMBLE = cn(
	'prose-p:my-2.5 prose-p:leading-[1.65] prose-p:text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--bubble-mix-tint)_6%)] ',
	'prose-ul:my-2.5 prose-ol:my-2.5 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-1 prose-li:leading-[1.65] prose-li:text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--bubble-mix-tint)_6%)] ',
	'prose-blockquote:text-[color-mix(in_srgb,var(--desktop-text-secondary)_92%,var(--bubble-mix-tint)_8%)] ',
	'prose-td:text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--bubble-mix-tint)_6%)] '
);

const PROSE_BUBBLE_BODY_DEFAULT_LIGHT = cn(
	'prose-p:my-2.5 prose-p:text-(--desktop-text-primary) prose-p:font-medium prose-p:leading-[1.65] ',
	'prose-ul:my-2.5 prose-ol:my-2.5 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-1 prose-li:text-(--desktop-text-primary) prose-li:font-medium prose-li:leading-[1.65] ',
	'prose-blockquote:text-(--desktop-text-secondary) ',
	'prose-td:text-(--desktop-text-secondary) '
);

const PROSE_DOCUMENT_OVERRIDES = cn(
	'prose-base leading-[1.72]',
	'prose-h1:mb-3 prose-h1:mt-6 prose-h1:text-xl',
	'prose-h2:mb-2.5 prose-h2:mt-5 prose-h2:text-lg',
	'prose-h3:mb-1.5 prose-h3:mt-4 prose-h3:text-base',
	'prose-p:my-2.5 prose-p:leading-[1.72]',
	'prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-li:leading-[1.65]',
	'prose-blockquote:my-3 prose-blockquote:px-3.5 prose-blockquote:py-2.5',
	'prose-table:text-[0.8125rem] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
	'prose-pre:text-sm'
);

export type DesktopAiMarkdownPresentation = 'chat' | 'document';

export function chatMarkdownRootClass(
	ensembleBodyTintHex: string | undefined,
	shellTheme: DesktopShellTheme,
	presentation: DesktopAiMarkdownPresentation
) {
	let base: string;
	if (shellTheme === 'light') {
		if (!ensembleBodyTintHex) {
			base = cn(PROSE_BUBBLE_BASE_LIGHT, PROSE_BUBBLE_BODY_DEFAULT_LIGHT);
		} else {
			base = cn(PROSE_BUBBLE_BASE_LIGHT, PROSE_BUBBLE_BODY_ENSEMBLE);
		}
	} else if (!ensembleBodyTintHex) {
		base = cn(PROSE_BUBBLE_BASE, PROSE_BUBBLE_BODY_DEFAULT);
	} else {
		base = cn(PROSE_BUBBLE_BASE, PROSE_BUBBLE_BODY_ENSEMBLE);
	}
	return cn(base, presentation === 'document' && PROSE_DOCUMENT_OVERRIDES);
}

export function chatMarkdownImgFrameClass(theme: DesktopShellTheme): string {
	if (theme === 'light') {
		return cn(
			'my-2.5 block w-fit max-w-full min-w-0 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-1 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]'
		);
	}
	return CHAT_MARKDOWN_IMG_FRAME;
}
