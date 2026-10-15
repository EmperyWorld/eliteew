/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TipTap / ProseMirror root and preview prose classNames keyed by desktop shell theme.
 *
 * Invariants:
 * - `prose-invert` only on dark canvases; light shell keeps primary text readable.
 * - Focus ring stays soft (`DOC_EDITOR_PROSE_FOCUS_CLASS`).
 *
 * Related:
 * - chrome/docEditorCanvasChrome.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DOC_EDITOR_PROSE_FOCUS_CLASS } from '../chrome/docEditorCanvasChrome';

/**
 * TipTap root: `prose-invert` is for dark canvases; on light shell it washes text to pale gray.
 */
export function getTiptapEditorRootClassName(theme: DesktopShellTheme): string {
	if (theme === 'light') {
		return cn(
			'tiptap ProseMirror prose prose-lg max-w-none min-h-[min(28rem,70vh)]',
			'bg-transparent px-6 py-6 sm:px-10 sm:py-9',
			'text-[color:var(--desktop-text-primary)]',
			'[&_.ProseMirror]:text-[color:var(--desktop-text-primary)]',
			'[&_p]:font-medium [&_p]:text-[color:var(--desktop-text-primary)] [&_p]:leading-relaxed',
			'[&_li]:font-medium [&_li]:text-[color:var(--desktop-text-primary)]',
			'[&_h1]:font-semibold [&_h1]:text-[color:var(--desktop-text-primary)]',
			'[&_h2]:font-semibold [&_h2]:text-[color:var(--desktop-text-primary)]',
			'[&_h3]:font-semibold [&_h3]:text-[color:var(--desktop-text-primary)]',
			'[&_h4]:font-semibold [&_h4]:text-[color:var(--desktop-text-primary)]',
			'[&_strong]:font-semibold [&_strong]:text-[color:var(--desktop-text-primary)]',
			'[&_blockquote]:text-[color:var(--desktop-text-secondary)]',
			'[&_code]:text-[rgb(var(--desktop-accent-rgb))]',
			'[&_a]:text-[rgb(var(--desktop-accent-rgb))]',
			DOC_EDITOR_PROSE_FOCUS_CLASS
		);
	}
	return cn(
		'tiptap ProseMirror prose prose-lg prose-invert max-w-none min-h-[min(28rem,70vh)]',
		'bg-transparent px-6 py-6 text-(--desktop-text-primary) sm:px-10 sm:py-9',
		'[&_p]:leading-relaxed [&_p]:text-(--desktop-text-primary)',
		'[&_li]:text-(--desktop-text-primary)',
		'[&_h1]:font-semibold [&_h1]:text-(--desktop-text-primary)',
		'[&_h2]:font-semibold [&_h2]:text-(--desktop-text-primary)',
		'[&_h3]:font-semibold [&_h3]:text-(--desktop-text-primary)',
		'[&_h4]:font-semibold [&_h4]:text-(--desktop-text-primary)',
		'[&_strong]:text-(--desktop-text-primary)',
		'[&_blockquote]:text-(--desktop-text-secondary)',
		'[&_code]:text-[rgb(var(--desktop-accent-rgb))]',
		'[&_a]:text-[rgb(var(--desktop-accent-rgb))]',
		DOC_EDITOR_PROSE_FOCUS_CLASS
	);
}

export function getDocEditorHtmlPreviewClassName(
	theme: DesktopShellTheme
): string {
	if (theme === 'light') {
		return cn(
			'prose max-w-none',
			'text-[color:var(--desktop-text-primary)]',
			'[&_p]:font-medium [&_p]:text-[color:var(--desktop-text-primary)]',
			'prose-headings:text-[color:var(--desktop-text-primary)] prose-headings:font-semibold',
			'prose-strong:text-[color:var(--desktop-text-primary)] prose-strong:font-semibold',
			'prose-code:text-[rgb(var(--desktop-accent-rgb))]',
			'prose-a:text-[rgb(var(--desktop-accent-rgb))]'
		);
	}
	return 'prose prose-invert max-w-none text-[var(--desktop-text-secondary)] prose-headings:text-[var(--desktop-text-primary)] prose-p:text-[var(--desktop-text-secondary)] prose-strong:text-[var(--desktop-text-primary)] prose-code:text-[rgb(var(--desktop-accent-rgb))] prose-a:text-[rgb(var(--desktop-accent-rgb))]';
}

export function getDocEditorPanelProseClassName(
	theme: DesktopShellTheme
): string {
	if (theme === 'light') {
		return cn(
			'prose max-w-none p-4 text-sm',
			'text-[color:var(--desktop-text-secondary)]',
			'[&_p]:font-medium [&_p]:text-[color:var(--desktop-text-primary)]',
			'prose-headings:text-[color:var(--desktop-text-primary)] prose-headings:font-semibold',
			'prose-strong:text-[color:var(--desktop-text-primary)] prose-strong:font-semibold',
			'prose-code:text-[rgb(var(--desktop-accent-rgb))]',
			'[&_li]:font-medium [&_li]:text-[color:var(--desktop-text-primary)]'
		);
	}
	return 'prose prose-invert max-w-none p-4 text-sm text-(--desktop-text-secondary)';
}

/** Template preview modal — same issue as main editor (`prose-invert` on light shell). */
export function getDocumentTemplateCardProseClassName(
	theme: DesktopShellTheme
): string {
	if (theme === 'light') {
		return cn(
			'prose max-w-none',
			'text-[color:var(--desktop-text-secondary)]',
			'[&_p]:font-medium [&_p]:text-[color:var(--desktop-text-primary)]',
			'prose-headings:text-[color:var(--desktop-text-primary)] prose-headings:font-semibold',
			'prose-strong:text-[color:var(--desktop-text-primary)] prose-strong:font-semibold',
			'prose-code:text-[rgb(var(--desktop-accent-rgb))]',
			'prose-pre:bg-(--desktop-surface-soft)',
			'prose-table:text-[color:var(--desktop-text-primary)]'
		);
	}
	return 'prose prose-invert max-w-none text-(--desktop-text-secondary) prose-headings:text-(--desktop-text-primary) prose-strong:text-(--desktop-text-primary) prose-code:text-[rgb(var(--desktop-accent-rgb))] prose-pre:bg-(--desktop-surface-soft) prose-table:text-(--desktop-text-secondary)';
}
