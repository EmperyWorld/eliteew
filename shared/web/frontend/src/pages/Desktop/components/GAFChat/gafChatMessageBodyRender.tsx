import { AssistantMessageRenderer } from '@/components/assistantMessage';
import { cn } from '@/utils/cn';
import * as React from 'react';

/**
 * Markdown в GAF: класс мёрджится с `ASSISTANT_PROSE` (там `PROSE_CONTAINER` ≈ 15px).
 * Нужны `!` на корне и на `p`/`li`, иначе размер «собеседник / я» не различим.
 * Кегль 15px — `DESKTOP_TYPOGRAPHY.shellCopy15`.
 */
const GAF_MD_BASE = cn(
	'[&_p]:my-0 [&_p]:!leading-[1.45]',
	'[&_ul]:my-1 [&_ol]:my-1 [&_ul]:!space-y-0.5 [&_ol]:!space-y-0.5',
	'[&_blockquote]:!my-2 [&_blockquote]:!py-1.5 [&_blockquote]:!text-[0.95em]',
	'[&_hr]:!my-3 [&_hr]:!border-(--desktop-border-subtle)',
	'[&_a]:!text-[rgb(var(--desktop-accent-rgb))] [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'[&_code]:!text-(--desktop-text-primary)',
	'[&_pre]:!max-w-full [&_pre]:!overflow-x-auto',
	/** Блоки кода (обёртка fenced) — плотнее, чем дефолтный my-4 у каркаса ассистента */
	'[&>div]:!my-2 [&>div]:!max-w-full'
);

/** Исходящие: спокойный контраст на тёплом акцентном фоне пузыря. */
export const GAF_BUBBLE_MARKDOWN_PROSE_OUTGOING = cn(
	GAF_MD_BASE,
	'!text-[15px] !font-normal !leading-[1.5] !text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--desktop-text-primary))] antialiased [font-feature-settings:"kern"_1,"liga"_1]',
	'[&_p]:!text-[15px] [&_p]:!font-normal [&_p]:!leading-[1.5] [&_p]:!text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--desktop-text-primary))]',
	'[&_li]:!text-[15px] [&_li]:!font-normal [&_li]:!leading-[1.5] [&_li]:!text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--desktop-text-primary))]',
	'[&_strong]:!font-semibold [&_strong]:!text-[color-mix(in_srgb,var(--desktop-text-secondary)_88%,var(--desktop-text-primary))]',
	'[&_em]:!italic [&_em]:!text-[15px] [&_em]:!text-[color-mix(in_srgb,var(--desktop-text-secondary)_85%,var(--desktop-text-primary))]'
);

/** Входящие: тот же кегль, чуть плотнее начертание для читаемости на нейтральном фоне. */
export const GAF_BUBBLE_MARKDOWN_PROSE_INCOMING = cn(
	GAF_MD_BASE,
	'!text-[15px] !font-medium !leading-[1.5] !text-(--desktop-text-primary) antialiased [font-feature-settings:"kern"_1,"liga"_1]',
	'[&_p]:!text-[15px] [&_p]:!font-medium [&_p]:!text-(--desktop-text-primary) [&_p]:!leading-[1.5]',
	'[&_li]:!text-[15px] [&_li]:!font-medium [&_li]:!leading-[1.5] [&_li]:!text-(--desktop-text-primary)',
	'[&_strong]:!font-semibold [&_strong]:!text-(--desktop-text-primary)',
	'[&_a]:!font-medium [&_em]:!text-[15px] [&_em]:!italic [&_em]:!font-medium [&_em]:!text-[color-mix(in_srgb,var(--desktop-text-primary)_90%,var(--desktop-text-secondary))]'
);

/** Плоский текст / linkify: наследование от пузыря недостаточно — задаём явно. */
export const GAF_PLAIN_BODY_OUTGOING =
	'!text-[15px] !font-normal !leading-[1.5] !text-[color-mix(in_srgb,var(--desktop-text-secondary)_94%,var(--desktop-text-primary))] [&_a]:!text-[15px]';

export const GAF_PLAIN_BODY_INCOMING =
	'!text-[15px] !font-medium !leading-[1.5] !text-(--desktop-text-primary) [&_a]:!text-[15px] [&_a]:!font-medium';

export function renderGafMessageContent(
	text: string,
	proseClassName?: string,
	plainShellClassName?: string
): React.ReactNode {
	if (text.includes('```')) {
		return (
			<AssistantMessageRenderer content={text} className={proseClassName} />
		);
	}
	if (/(https?:\/\/)/i.test(text)) {
		return (
			<div
				className={cn(
					'wrap-anywhere whitespace-pre-wrap leading-[1.45]',
					plainShellClassName
				)}
			>
				{renderLinkifiedPlainText(text)}
			</div>
		);
	}
	return (
		<div
			className={cn(
				'wrap-anywhere whitespace-pre-wrap leading-[1.45]',
				plainShellClassName
			)}
		>
			{text}
		</div>
	);
}

/** Safe https linkify for plaintext (no HTML from server). */
export function renderLinkifiedPlainText(text: string): React.ReactNode {
	const re = /(https?:\/\/[^\s<>[\]()]+)/gi;
	const nodes: React.ReactNode[] = [];
	let last = 0;
	let key = 0;
	const r = new RegExp(re.source, re.flags);
	let m: RegExpExecArray | null = r.exec(text);
	while (m !== null) {
		if (m.index > last) {
			nodes.push(<span key={key++}>{text.slice(last, m.index)}</span>);
		}
		let href = m[1];
		while (/[).,;]$/.test(href)) {
			href = href.slice(0, -1);
		}
		nodes.push(
			<a
				key={key++}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="text-[rgb(var(--desktop-accent-rgb))] underline underline-offset-2 decoration-[rgb(var(--desktop-accent-rgb)/0.45)]"
			>
				{m[1]}
			</a>
		);
		last = m.index + m[1].length;
		m = r.exec(text);
	}
	if (last < text.length) {
		nodes.push(<span key={key++}>{text.slice(last)}</span>);
	}
	return nodes.length > 0 ? nodes : text;
}

export { renderLinkifiedPlainText as renderSystemLinkifiedPlainText };

/** Highlights all case-insensitive matches in plain text (chat thread search). */
export function highlightSearchInPlainText(
	text: string,
	query: string
): React.ReactNode {
	const q = query.trim();
	if (!q) return text;
	const lower = text.toLowerCase();
	const qLower = q.toLowerCase();
	if (!lower.includes(qLower)) return text;
	const parts: React.ReactNode[] = [];
	let start = 0;
	let idx = lower.indexOf(qLower, start);
	let key = 0;
	while (idx !== -1) {
		if (idx > start) {
			parts.push(<span key={key++}>{text.slice(start, idx)}</span>);
		}
		parts.push(
			<mark
				key={key++}
				className="rounded-sm bg-amber-400/40 px-0.5 text-inherit ring-1 ring-amber-500/35"
			>
				{text.slice(idx, idx + q.length)}
			</mark>
		);
		start = idx + q.length;
		idx = lower.indexOf(qLower, start);
	}
	if (start < text.length) {
		parts.push(<span key={key++}>{text.slice(start)}</span>);
	}
	return <>{parts}</>;
}
