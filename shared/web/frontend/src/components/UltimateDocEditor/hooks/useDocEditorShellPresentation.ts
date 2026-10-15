/**
 * Классы презентации shell для UltimateDocEditor (пресет окна, метрики, превью).
 */

import { useMemo } from 'react';

import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import type { DesktopWindowStyle } from '@/types/profile';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellContentPanelClassName,
	getDesktopShellEastColumnClassName,
	getDesktopShellPanelClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

import { getDocEditorHtmlPreviewClassName } from '../utils/tiptapProseThemeClass';

type DocEditorShellFramePreset =
	(typeof DESKTOP_WINDOW_FRAME_STYLES)[DesktopWindowStyle];

/** Вертикальный разделитель между зонами тулбара (и внутри кластера «Файл»). */
export const DOC_EDITOR_HEADER_TOOLBAR_VSEP_CLASS =
	'hidden h-9 w-px shrink-0 self-center bg-[color-mix(in_srgb,var(--desktop-border-strong)_65%,transparent)] md:block';

export interface DocEditorShellPresentation {
	shellFramePreset: DocEditorShellFramePreset;
	docToolbarClusterClass: string;
	docHeaderMetaStripClass: string;
	docHeaderToolbarVSepClass: string;
	metricBadgeDefaultSurface: string;
	docScrollFabClass: string;
	docMarkdownTextareaClass: string;
	embeddedEastColumnClass: string;
	docGuideCardClass: string;
	memoryWarningSurfaceClass: string;
	docPreviewProseClassName: string;
}

export function useDocEditorShellPresentation(
	shellFrame: DesktopWindowStyle,
	shellTheme: DesktopShellTheme
): DocEditorShellPresentation {
	const shellFramePreset = useMemo(
		(): DocEditorShellFramePreset =>
			DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
			DESKTOP_WINDOW_FRAME_STYLES.glass,
		[shellFrame]
	);

	const docToolbarClusterClass = useMemo(
		() =>
			cn(
				'flex min-h-9 items-center gap-1.5 rounded-2xl px-2 py-1.5 shadow-[0_10px_24px_rgba(2,6,23,0.12)] sm:min-h-10 sm:px-2.5 sm:py-2',
				getDesktopShellContentPanelClassName(shellFrame),
				'rounded-2xl'
			),
		[shellFrame]
	);

	const docHeaderMetaStripClass = useMemo(
		() =>
			cn(
				'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl px-2 py-1.5 sm:px-2.5',
				getDesktopShellToolbarClusterClassName(shellFrame)
			),
		[shellFrame]
	);

	const metricBadgeDefaultSurface = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);

	const docScrollFabClass = useMemo(
		() =>
			cn(
				'pointer-events-auto h-10 w-10 backdrop-blur-sm',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
			),
		[shellFrame]
	);

	const docMarkdownTextareaClass = useMemo(
		() =>
			cn(
				'min-h-[680px] w-full resize-none rounded-2xl p-5 font-mono text-[13px] leading-7 text-[var(--desktop-text-primary)] outline-none transition-colors placeholder:text-[var(--desktop-text-dim)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb))]/25',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
			),
		[shellFrame]
	);

	const embeddedEastColumnClass = useMemo(() => {
		const preset =
			DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
			DESKTOP_WINDOW_FRAME_STYLES.glass;
		return cn(getDesktopShellEastColumnClassName(shellFrame), preset.shell);
	}, [shellFrame]);

	const docGuideCardClass = useMemo(
		() =>
			cn(
				'absolute left-1/2 top-20 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 overflow-hidden',
				getDesktopShellPanelClassName(shellFrame, 'standard')
			),
		[shellFrame]
	);

	const memoryWarningSurfaceClass = useMemo(
		() =>
			cn(
				getDesktopShellPanelClassName(shellFrame, 'standard'),
				'border-red-500/45 shadow-(--desktop-shadow-panel)'
			),
		[shellFrame]
	);

	const docPreviewProseClassName = useMemo(
		() => getDocEditorHtmlPreviewClassName(shellTheme),
		[shellTheme]
	);

	return {
		shellFramePreset,
		docToolbarClusterClass,
		docHeaderMetaStripClass,
		docHeaderToolbarVSepClass: DOC_EDITOR_HEADER_TOOLBAR_VSEP_CLASS,
		metricBadgeDefaultSurface,
		docScrollFabClass,
		docMarkdownTextareaClass,
		embeddedEastColumnClass,
		docGuideCardClass,
		memoryWarningSurfaceClass,
		docPreviewProseClassName,
	};
}
