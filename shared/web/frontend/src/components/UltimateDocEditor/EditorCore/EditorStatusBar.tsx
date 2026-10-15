/**
 * 🔥💎 Editor Status Bar 💎🔥
 *
 * Status bar showing word count, character count, cursor position
 *
 * Created: 2025-10-18
 */

import type { Editor } from '@tiptap/react';
import * as React from 'react';
import {
	ArrowDownTrayIcon,
	BoltIcon,
	ClockIcon,
	CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import { countWordsFromPlainText } from '../utils/htmlWordCount';
import {
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';

interface EditorStatusBarProps {
	editor: Editor | null;
	/** Optional one-line document label (truncated when long) */
	documentTitle?: string | null;
	isSaving?: boolean;
	lastSaved?: Date;
	gpuEnabled?: boolean;
	performanceMetrics?: {
		renderTime?: number;
		memoryUsage?: number;
	};
	className?: string;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({
	editor,
	documentTitle,
	isSaving,
	lastSaved,
	gpuEnabled = true,
	performanceMetrics,
	className,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	if (!editor) {
		return null;
	}

	// Get statistics
	const text = editor.getText();
	const words = countWordsFromPlainText(text);
	const characters = text.length;
	const wordsDisplay = words.toLocaleString();
	const charsDisplay = characters.toLocaleString();

	// Get cursor position
	const { from } = editor.state.selection;
	const pos = editor.state.doc.resolve(from);

	// Calculate line number by counting newlines before the cursor position
	const textBeforeCursor = editor.state.doc.textBetween(0, from, '\n', '\n');
	const line = textBeforeCursor.split('\n').length;

	// Calculate column position within the current line
	const column = from - pos.start(pos.depth);

	// Format last saved time
	const formatTime = (date: Date) => {
		const diff = Date.now() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return t('statusBar.savedHours', { count: hours });
		}
		if (minutes > 0) {
			return t('statusBar.savedMinutes', { count: minutes });
		}
		if (seconds > 10) {
			return t('statusBar.savedSeconds', { count: seconds });
		}
		return t('statusBar.savedJustNow');
	};

	const savedRelative = lastSaved ? formatTime(lastSaved) : '';
	const savedLabel = lastSaved
		? `${t('statusBar.savedPrefix')} ${savedRelative}`
		: '';
	const cursorSummary = t('statusBar.cursorLineCol', { line, column });

	return (
		<DesktopAppPanel
			className={`editor-status-bar flex min-w-0 max-w-full shrink-0 flex-col gap-2 px-2 py-2 text-xs ${className ?? ''}`}
		>
			{documentTitle ? (
				<DesktopAppPanel className="min-w-0 overflow-hidden px-2 py-1.5">
					<DesktopAppSectionLabel>
						{t('statusBar.document')}
					</DesktopAppSectionLabel>
					<p
						className="mt-1 min-w-0 truncate font-medium text-(--desktop-text-primary)"
						title={documentTitle}
					>
						{documentTitle}
					</p>
				</DesktopAppPanel>
			) : null}
			<div className="flex min-w-0 flex-col gap-1.5">
				<DesktopAppPanel className="min-w-0 overflow-hidden px-2 py-1">
					<DesktopAppSectionLabel>
						{t('statusBar.words')}
					</DesktopAppSectionLabel>
					<div
						className="mt-1 min-w-0 truncate font-semibold tabular-nums text-(--desktop-text-primary)"
						title={wordsDisplay}
					>
						{wordsDisplay}
					</div>
				</DesktopAppPanel>
				<DesktopAppPanel className="min-w-0 overflow-hidden px-2 py-1">
					<DesktopAppSectionLabel>
						{t('statusBar.chars')}
					</DesktopAppSectionLabel>
					<div
						className="mt-1 min-w-0 truncate font-semibold tabular-nums text-(--desktop-text-primary)"
						title={charsDisplay}
					>
						{charsDisplay}
					</div>
				</DesktopAppPanel>
				<DesktopAppPanel className="min-w-0 overflow-hidden px-2 py-1">
					<DesktopAppSectionLabel>
						{t('statusBar.cursor')}
					</DesktopAppSectionLabel>
					<div
						className="mt-1 min-w-0 truncate text-(--desktop-text-secondary) tabular-nums"
						title={cursorSummary}
					>
						Ln{' '}
						<span className="font-semibold text-(--desktop-text-primary)">
							{line}
						</span>
						<span className="px-1 text-(--desktop-text-dim)">·</span>
						Col{' '}
						<span className="font-semibold text-(--desktop-text-primary)">
							{column}
						</span>
						<span className="sr-only"> — {cursorSummary}</span>
					</div>
				</DesktopAppPanel>
			</div>

			<div className="mt-1 flex min-w-0 flex-col gap-1.5 border-t border-(--desktop-border-subtle) pt-2">
				<span className="sr-only" aria-live="polite">
					{isSaving
						? t('statusBar.statusPrefixSaving')
						: lastSaved
							? `${t('statusBar.statusPrefixSaved')} ${savedRelative}`
							: ''}
				</span>
				{isSaving && (
					<DesktopAppStatusBadge className="min-w-0 justify-start gap-1.5 border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-white motion-reduce:animate-none">
						<ArrowDownTrayIcon
							width={12}
							height={12}
							className="shrink-0 animate-pulse motion-reduce:animate-none"
							aria-hidden
						/>
						<span className="min-w-0 truncate">{t('statusBar.saving')}</span>
					</DesktopAppStatusBadge>
				)}
				{lastSaved && !isSaving && (
					<DesktopAppStatusBadge className="min-w-0 justify-start gap-1.5 border-emerald-400/30 bg-emerald-500/12 text-emerald-100">
						<ClockIcon
							width={12}
							height={12}
							className="shrink-0"
							aria-hidden
						/>
						<span className="min-w-0 truncate" title={savedLabel}>
							<span className="font-medium">{t('statusBar.savedPrefix')}</span>{' '}
							{savedRelative}
						</span>
					</DesktopAppStatusBadge>
				)}
				<DesktopAppPanel className="flex min-w-0 flex-col gap-1 overflow-hidden px-2 py-1">
					{gpuEnabled ? (
						<div className="flex min-w-0 items-center gap-1">
							<BoltIcon
								width={12}
								height={12}
								className="shrink-0 text-emerald-300"
								aria-hidden
							/>
							<span className="min-w-0 truncate font-medium text-emerald-200">
								{t('statusBar.renderModeGpu')}
							</span>
						</div>
					) : (
						<div className="flex min-w-0 items-center gap-1">
							<CpuChipIcon
								width={12}
								height={12}
								className="shrink-0 text-amber-300"
								aria-hidden
							/>
							<span className="min-w-0 truncate font-medium text-amber-200">
								{t('statusBar.renderModeCpu')}
							</span>
						</div>
					)}
					{performanceMetrics?.renderTime != null && (
						<span className="tabular-nums text-(--desktop-text-muted)">
							{performanceMetrics.renderTime.toFixed(1)}ms
						</span>
					)}
					{performanceMetrics?.memoryUsage != null && (
						<span className="tabular-nums text-(--desktop-text-muted)">
							{performanceMetrics.memoryUsage.toFixed(1)}MB
						</span>
					)}
				</DesktopAppPanel>
			</div>
		</DesktopAppPanel>
	);
};
