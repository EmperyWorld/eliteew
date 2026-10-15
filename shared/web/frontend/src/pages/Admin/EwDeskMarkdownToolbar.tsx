/**
 * Markdown formatting toolbar for EWDesk admin body textarea.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '../Desktop/constants';
import { prefixLine, wrapSelection } from './ewDeskMarkdownEditor';
import {
	Bars3BottomLeftIcon,
	BoldIcon,
	ChatBubbleBottomCenterTextIcon,
	ClipboardDocumentListIcon,
	CodeBracketIcon,
	CodeBracketSquareIcon,
	ItalicIcon,
	LinkIcon,
	ListBulletIcon,
	MinusIcon,
	NumberedListIcon,
	PhotoIcon,
	StrikethroughIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';

type Props = {
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	setBody: React.Dispatch<React.SetStateAction<string>>;
};

function applyEdit(
	textareaRef: React.RefObject<HTMLTextAreaElement | null>,
	setBody: React.Dispatch<React.SetStateAction<string>>,
	edit: (
		text: string,
		start: number,
		end: number
	) => { newText: string; selStart: number; selEnd: number }
): void {
	const el = textareaRef.current;
	if (!el) return;
	const text = el.value;
	const start = el.selectionStart;
	const end = el.selectionEnd;
	const { newText, selStart, selEnd } = edit(text, start, end);
	setBody(newText);
	setTimeout(() => {
		const t = textareaRef.current;
		if (!t) return;
		t.focus();
		t.setSelectionRange(selStart, selEnd);
	}, 0);
}

export function EwDeskMarkdownToolbar({
	textareaRef,
	setBody,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'ewDeskAdmin.editorToolbar',
	});

	const btnClass = cn(
		'h-8 min-w-8 shrink-0 px-2',
		'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-panel) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);

	const run = React.useCallback(
		(
			fn: (
				text: string,
				s: number,
				e: number
			) => { newText: string; selStart: number; selEnd: number }
		) => {
			applyEdit(textareaRef, setBody, fn);
		},
		[setBody, textareaRef]
	);

	return (
		<div
			className={cn(
				'flex flex-wrap items-center gap-0.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,transparent)] p-1.5',
				'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
			)}
			role="toolbar"
			aria-label={t('toolbarAria')}
		>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('bold')}
				aria-label={t('bold')}
				onClick={() =>
					run((text, start, end) =>
						wrapSelection(text, start, end, '**', '**', t('placeholderBold'))
					)
				}
			>
				<BoldIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('italic')}
				aria-label={t('italic')}
				onClick={() =>
					run((text, start, end) =>
						wrapSelection(text, start, end, '*', '*', t('placeholderItalic'))
					)
				}
			>
				<ItalicIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('strike')}
				aria-label={t('strike')}
				onClick={() =>
					run((text, start, end) =>
						wrapSelection(text, start, end, '~~', '~~', t('placeholderStrike'))
					)
				}
			>
				<StrikethroughIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<span
				className="mx-0.5 h-5 w-px shrink-0 bg-(--desktop-border-subtle)"
				aria-hidden
			/>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('h1')}
				aria-label={t('h1')}
				onClick={() => run((text, start) => prefixLine(text, start, '# '))}
			>
				<Bars3BottomLeftIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('h2')}
				aria-label={t('h2')}
				onClick={() => run((text, start) => prefixLine(text, start, '## '))}
			>
				<Bars3BottomLeftIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('h3')}
				aria-label={t('h3')}
				onClick={() => run((text, start) => prefixLine(text, start, '### '))}
			>
				<Bars3BottomLeftIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('h4')}
				aria-label={t('h4')}
				onClick={() => run((text, start) => prefixLine(text, start, '#### '))}
			>
				<Bars3BottomLeftIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<span
				className="mx-0.5 h-5 w-px shrink-0 bg-(--desktop-border-subtle)"
				aria-hidden
			/>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('bulletList')}
				aria-label={t('bulletList')}
				onClick={() => run((text, start) => prefixLine(text, start, '- '))}
			>
				<ListBulletIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('orderedList')}
				aria-label={t('orderedList')}
				onClick={() => run((text, start) => prefixLine(text, start, '1. '))}
			>
				<NumberedListIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('taskList')}
				aria-label={t('taskList')}
				onClick={() => run((text, start) => prefixLine(text, start, '- [ ] '))}
			>
				<ClipboardDocumentListIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('quote')}
				aria-label={t('quote')}
				onClick={() => run((text, start) => prefixLine(text, start, '> '))}
			>
				<ChatBubbleBottomCenterTextIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('hr')}
				aria-label={t('hr')}
				onClick={() =>
					run((text, start, end) => {
						const padBefore =
							start > 0 && text[start - 1] !== '\n'
								? '\n\n'
								: start > 0
									? '\n'
									: '';
						const ins = `${padBefore}---\n`;
						const newText = text.slice(0, start) + ins + text.slice(end);
						const pos = start + ins.length;
						return { newText, selStart: pos, selEnd: pos };
					})
				}
			>
				<MinusIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<span
				className="mx-0.5 h-5 w-px shrink-0 bg-(--desktop-border-subtle)"
				aria-hidden
			/>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('link')}
				aria-label={t('link')}
				onClick={() => {
					const el = textareaRef.current;
					if (!el) return;
					const start = el.selectionStart;
					const end = el.selectionEnd;
					const text = el.value;
					const selected = text.slice(start, end);
					const urlRaw = window.prompt(t('linkUrlPrompt'), 'https://');
					if (urlRaw == null) return;
					const url = urlRaw.trim();
					if (!url) return;
					const label =
						selected.trim() || window.prompt(t('linkTextPrompt'), url) || url;
					const md = `[${label}](${url})`;
					const newText = text.slice(0, start) + md + text.slice(end);
					setBody(newText);
					const pos = start + md.length;
					setTimeout(() => {
						const ta = textareaRef.current;
						if (!ta) return;
						ta.focus();
						ta.setSelectionRange(pos, pos);
					}, 0);
				}}
			>
				<LinkIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('image')}
				aria-label={t('image')}
				onClick={() => {
					const el = textareaRef.current;
					if (!el) return;
					const start = el.selectionStart;
					const end = el.selectionEnd;
					const text = el.value;
					const selected = text.slice(start, end);
					const urlRaw = window.prompt(t('imageUrlPrompt'), 'https://');
					if (urlRaw == null) return;
					const url = urlRaw.trim();
					if (!url) return;
					const alt =
						selected.trim() ||
						window.prompt(t('imageAltPrompt'), '') ||
						t('placeholderImageAlt');
					const md = `![${alt}](${url})`;
					const newText = text.slice(0, start) + md + text.slice(end);
					setBody(newText);
					const pos = start + md.length;
					setTimeout(() => {
						const ta = textareaRef.current;
						if (!ta) return;
						ta.focus();
						ta.setSelectionRange(pos, pos);
					}, 0);
				}}
			>
				<PhotoIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('table')}
				aria-label={t('table')}
				onClick={() =>
					run((text, start, end) => {
						const h1 = t('tableHeader1');
						const h2 = t('tableHeader2');
						const padBefore =
							start > 0 && text[start - 1] !== '\n'
								? '\n\n'
								: start > 0
									? '\n'
									: '';
						const block = `${padBefore}| ${h1} | ${h2} |\n| --- | --- |\n|  |  |\n`;
						const newText = text.slice(0, start) + block + text.slice(end);
						const pos = start + block.length;
						return { newText, selStart: pos, selEnd: pos };
					})
				}
			>
				<TableCellsIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('inlineCode')}
				aria-label={t('inlineCode')}
				onClick={() =>
					run((text, start, end) =>
						wrapSelection(text, start, end, '`', '`', t('placeholderCode'))
					)
				}
			>
				<CodeBracketIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="ghost"
				size="sm"
				className={btnClass}
				title={t('codeBlock')}
				aria-label={t('codeBlock')}
				onClick={() =>
					run((text, start, end) => {
						const inner =
							start === end
								? t('placeholderCodeBlock')
								: text.slice(start, end);
						const before = '```\n';
						const after = '\n```';
						const inserted = before + inner + after;
						const newText = text.slice(0, start) + inserted + text.slice(end);
						const selStart = start + before.length;
						const selEnd = selStart + inner.length;
						return { newText, selStart, selEnd };
					})
				}
			>
				<CodeBracketSquareIcon
					className="h-4 w-4"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
		</div>
	);
}
