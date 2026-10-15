/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mermaid fence render + fullscreen modal for Desktop AI Chat markdown.
 *
 * Invariants:
 * - Mermaid SVG is cached; cleanup must not wipe host on parent remount (desktop-ai-chat-001).
 * - initialize always re-applies dagre/classic + root htmlLabels (singleton vs Doc Editor).
 *
 * Related:
 * - DesktopAiChatMarkdown.tsx (facade)
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowsPointingOutIcon,
	GlobeAltIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_PORTAL_STACK_BUMP,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { getDesktopPortalShellProps } from '@/pages/Desktop/shell';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { cn } from '@/utils/cn';
import { sanitizeMermaidSvg } from '@/utils/sanitizeUserHtml';
import {
	isMermaidFlowchartSource,
	parseMermaidFlowchart,
	ProcessFlow,
} from '@/features/diagrams/process-flow';
import {
	isMermaidGanttSource,
	parseMermaidGantt,
	RoadmapTimeline,
} from '@/features/diagrams/roadmap';
import {
	isMermaidSequenceSource,
	parseMermaidSequence,
	SequenceFlow,
} from '@/features/diagrams/sequence-flow';

import {
	MERMAID_CHAT_HTML_LABELS,
	MERMAID_V12_PRODUCT_LAYOUT,
	mermaidV12FlowchartBlock,
	withMermaidExclusive,
} from '@/features/diagrams/mermaidProductLayout';
import {
	getDesktopAiChatMermaidSvgCache,
	setDesktopAiChatMermaidSvgCache,
} from './desktopAiChatMermaidCache';

/**
 * Модель часто вставляет первой строкой `mermaid` внутри fence **без** info string (` ``` `),
 * тогда commonmark даёт блок кода без `language-mermaid`. Для рендера mermaid нужно тело диаграммы
 * без этой строки.
 */
export function inferMermaidDiagramSource(raw: string): string | null {
	const t = raw.replace(/\n$/, '').trim();
	if (!/^\s*mermaid\s*\r?\n/i.test(t)) return null;
	const rest = t.replace(/^\s*mermaid\s*\r?\n/i, '').trim();
	if (!rest) return null;
	if (
		/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitgraph|mindmap|timeline|sankey)/i.test(
			rest
		)
	) {
		return rest;
	}
	return null;
}

/**
 * Инкрементировать после смены `initialize` / `themeVariables`, иначе при HMR
 * и SVG-cache остаётся старая тема. Ключ кэша: `${MERMAID_CONFIG_VERSION}:${palette}`.
 */
export const MERMAID_CONFIG_VERSION = 8;

export { MERMAID_V12_PRODUCT_LAYOUT } from '@/features/diagrams/mermaidProductLayout';

/** Report/long-read = paper-light; chat bubble = soft-dark (no near-black slabs). */
export type MermaidPalette = 'soft-dark' | 'paper-light';

function mermaidThemeVariables(
	palette: MermaidPalette
): Record<string, string | boolean> {
	if (palette === 'paper-light') {
		return {
			fontSize: '13px',
			darkMode: false,
			background: '#eef1f5',
			mainBkg: '#ffffff',
			secondBkg: '#f5f7fa',
			tertiaryColor: '#e4e9f0',
			primaryColor: '#d9e4f2',
			primaryTextColor: '#1c2430',
			secondaryTextColor: '#3d4654',
			tertiaryTextColor: '#5c6778',
			primaryBorderColor: '#8aa0bc',
			secondaryBorderColor: '#b0bac8',
			lineColor: '#5a6f8c',
			textColor: '#1c2430',
			border2: '#b0bac8',
			arrowheadColor: '#4a6280',
			clusterBkg: '#f5f7fa',
			clusterBorder: '#a8b4c4',
			defaultLinkColor: '#5a6f8c',
			titleColor: '#15202b',
			edgeLabelBackground: '#ffffffee',
			nodeTextColor: '#1c2430',
			nodeBorder: '#8aa0bc',
			actorBkg: '#ffffff',
			actorBorder: '#8aa0bc',
			actorTextColor: '#1c2430',
			signalColor: '#5a6f8c',
			labelBoxBkgColor: '#ffffff',
			labelBoxBorderColor: '#8aa0bc',
			labelTextColor: '#1c2430',
			classText: '#1c2430',
			sectionBkgColor: '#e2e8f0',
			altSectionBkgColor: '#f1f5f9',
			sectionBkgColor2: '#f1f5f9',
			taskBkgColor: '#3b6ea5',
			taskTextColor: '#ffffff',
			taskTextLightColor: '#ffffff',
			taskTextOutsideColor: '#1c2430',
			taskTextDarkColor: '#1c2430',
			activeTaskBkgColor: '#2f5f94',
			activeTaskBorderColor: '#1e3f66',
			gridColor: '#c5ced9',
			doneTaskBkgColor: '#3d8a68',
			doneTaskBorderColor: '#2a6149',
			critBkgColor: '#c45c5c',
			critBorderColor: '#8f3434',
			todayLineColor: '#b8860b',
			taskBorderColor: '#2a5078',
		};
	}
	// soft-dark: elevated slate, not near-black section slabs
	return {
		fontSize: '14px',
		darkMode: true,
		background: '#1c2129',
		mainBkg: '#2a313c',
		secondBkg: '#323a47',
		tertiaryColor: '#3a4352',
		primaryColor: '#3a4d66',
		primaryTextColor: '#eef0f4',
		secondaryTextColor: '#c4c9d4',
		tertiaryTextColor: '#9aa3b2',
		primaryBorderColor: '#7a8ca6',
		secondaryBorderColor: '#5c6778',
		lineColor: '#8a9bb5',
		textColor: '#eef0f4',
		border2: '#5c6778',
		arrowheadColor: '#9eb0c9',
		clusterBkg: '#242b35',
		clusterBorder: '#7a8ca6',
		defaultLinkColor: '#8a9bb5',
		titleColor: '#f2f4f8',
		edgeLabelBackground: '#2a313cee',
		nodeTextColor: '#eef0f4',
		nodeBorder: '#7a8ca6',
		actorBkg: '#2a313c',
		actorBorder: '#7a8ca6',
		actorTextColor: '#eef0f4',
		signalColor: '#8a9bb5',
		labelBoxBkgColor: '#323a47',
		labelBoxBorderColor: '#7a8ca6',
		labelTextColor: '#eef0f4',
		classText: '#eef0f4',
		sectionBkgColor: '#2a313c',
		altSectionBkgColor: '#323a47',
		sectionBkgColor2: '#323a47',
		taskBkgColor: '#4a7ab0',
		taskTextColor: '#ffffff',
		taskTextLightColor: '#ffffff',
		taskTextOutsideColor: '#c4c9d4',
		taskTextDarkColor: '#1c2129',
		activeTaskBkgColor: '#5b8fc4',
		activeTaskBorderColor: '#9ebddf',
		gridColor: '#3a4352',
		doneTaskBkgColor: '#3d8a68',
		doneTaskBorderColor: '#6fbf94',
		critBkgColor: '#a85a62',
		critBorderColor: '#d47a84',
		todayLineColor: '#d4a017',
		taskBorderColor: '#6b87a8',
	};
}

export function mermaidCacheConfigId(palette: MermaidPalette): string {
	return `${MERMAID_CONFIG_VERSION}:${palette}`;
}

async function ensureMermaidTheme(palette: MermaidPalette) {
	const mermaid = (await import('mermaid')).default;
	mermaid.initialize({
		startOnLoad: false,
		theme: 'base',
		htmlLabels: MERMAID_CHAT_HTML_LABELS,
		...MERMAID_V12_PRODUCT_LAYOUT,
		securityLevel: 'strict',
		fontFamily:
			'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
		flowchart: {
			...mermaidV12FlowchartBlock(MERMAID_CHAT_HTML_LABELS),
			nodeSpacing: 64,
			rankSpacing: 64,
			curve: 'basis',
		},
		sequence: {
			useMaxWidth: false,
			actorMargin: 28,
			boxMargin: 12,
			messageMargin: 40,
		},
		gantt: {
			useMaxWidth: true,
			barHeight: 22,
			barGap: 8,
			topPadding: 40,
			leftPadding: 72,
			gridLineStartPadding: 16,
			fontSize: 12,
			sectionFontSize: 13,
			numberSectionStyles: 2,
		},
		themeVariables: mermaidThemeVariables(palette),
	});
	return mermaid;
}

/**
 * Mermaid 11+ при ошибке парсинга часто не бросает — отдаёт строку с диагностикой.
 * Раньше в SVG был `class="error-text"`; в 11.13 встречается разметка с голым текстом
 * «Syntax error in text mermaid version …» (в т.ч. внутри div во вложенном SVG/HTML).
 */
function isMermaidRenderFailure(output: string): boolean {
	if (!output || typeof output !== 'string') return true;
	const s = output.toLowerCase();
	if (/aria-roledescription\s*=\s*["']error["']/i.test(output)) return true;
	if (s.includes('syntax error in text')) return true;
	if (s.includes('class="error-text"') || s.includes("class='error-text'"))
		return true;
	// Некоторые сборки: «…parse error… mermaid version …» без class="error-text".
	if (
		s.includes('mermaid version') &&
		(s.includes('syntax error') ||
			s.includes('parse error') ||
			s.includes('lexical error'))
	) {
		return true;
	}
	// Mermaid 11+ иногда отдаёт HTML/текст без корневого <svg>; без этого остаётся «пустой» ok + сирота в DOM.
	if (!/<svg[\s>]/i.test(output.trim())) {
		if (
			s.includes('syntax error') ||
			s.includes('parse error') ||
			s.includes('lexical error')
		) {
			return true;
		}
	}
	return false;
}

/** m.render(id, …) создаёт временные узлы `#id` и/или `#d${id}`; без удаления остаётся полноширинный div с текстом ошибки. */
function removeMermaidRenderArtifacts(renderId: string) {
	const ids = [renderId, `d${renderId}`];
	for (const cid of ids) {
		const el = document.getElementById(cid);
		if (!el) continue;
		try {
			el.remove();
		} catch {
			/* ignore */
		}
	}
}

/** Рендер fenced ```mermaid из ответа ассистента (lazy-load библиотеки). */
export const ChatMermaidBlock = React.memo(function ChatMermaidBlock({
	source,
	size = 'chat',
	palette: paletteProp,
	/** @deprecated use `size="fullscreen"` */
	expanded = false,
}: {
	source: string;
	/**
	 * `chat` — компактный пузырь; `document` — колонка отчёта (fit width);
	 * `fullscreen` — модалка (нативный размер SVG).
	 */
	size?: 'chat' | 'document' | 'fullscreen';
	/** Defaults: document → paper-light; chat/fullscreen → soft-dark. */
	palette?: MermaidPalette;
	/** Крупный режим (полноэкранная модалка). Prefer `size="fullscreen"`. */
	expanded?: boolean;
}) {
	const resolvedSize: 'chat' | 'document' | 'fullscreen' = expanded
		? 'fullscreen'
		: size;
	const palette: MermaidPalette =
		paletteProp ?? (resolvedSize === 'document' ? 'paper-light' : 'soft-dark');
	const isPaper = palette === 'paper-light';
	const cacheId = mermaidCacheConfigId(palette);
	const { t } = useTranslation('desktopAiChat');
	const hostRef = React.useRef<HTMLDivElement>(null);
	const stableId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '') || 'mmd';
	const renderSeqRef = React.useRef(0);
	const paintedSourceRef = React.useRef<string | null>(null);
	const [phase, setPhase] = React.useState<'loading' | 'ok' | 'error'>(
		'loading'
	);

	/** Не дергаем m.render на каждом чанке стрима — иначе неполный синтаксис даёт error-SVG подряд. */
	const [debouncedSource, setDebouncedSource] = React.useState(source);
	React.useEffect(() => {
		const id = window.setTimeout(() => setDebouncedSource(source), 380);
		return () => window.clearTimeout(id);
	}, [source]);

	React.useEffect(() => {
		let cancelled = false;
		const text = debouncedSource.trim();
		if (!text) {
			paintedSourceRef.current = null;
			if (hostRef.current) {
				hostRef.current.innerHTML = '';
			}
			setPhase('error');
			return;
		}

		const applySvg = (safeSvg: string) => {
			if (!hostRef.current) return;
			hostRef.current.innerHTML = safeSvg;
			paintedSourceRef.current = text;
			setPhase('ok');
		};

		const cached = getDesktopAiChatMermaidSvgCache(text, cacheId);
		if (cached) {
			applySvg(cached);
			return;
		}

		if (
			paintedSourceRef.current === text &&
			hostRef.current &&
			hostRef.current.innerHTML.length > 0
		) {
			setPhase('ok');
			return;
		}

		if (
			paintedSourceRef.current !== null &&
			paintedSourceRef.current !== text &&
			hostRef.current
		) {
			hostRef.current.innerHTML = '';
			paintedSourceRef.current = null;
		}

		setPhase('loading');
		void (async () => {
			let renderId: string | null = null;
			try {
				const { svg } = await withMermaidExclusive(async () => {
					const m = await ensureMermaidTheme(palette);
					if (cancelled) {
						return { svg: '' };
					}
					renderSeqRef.current += 1;
					renderId = `dcm-${stableId}-${renderSeqRef.current}`;
					return m.render(renderId, text);
				});
				if (renderId) removeMermaidRenderArtifacts(renderId);
				if (cancelled || !hostRef.current || !svg) return;
				if (isMermaidRenderFailure(svg)) {
					hostRef.current.innerHTML = '';
					paintedSourceRef.current = null;
					setPhase('error');
					return;
				}
				const safeSvg = sanitizeMermaidSvg(svg);
				if (isMermaidRenderFailure(safeSvg)) {
					hostRef.current.innerHTML = '';
					paintedSourceRef.current = null;
					setPhase('error');
					return;
				}
				setDesktopAiChatMermaidSvgCache(text, safeSvg, cacheId);
				// Только этот div не содержит React-children — иначе innerHTML ломает reconciler (removeChild).
				applySvg(safeSvg);
			} catch {
				if (renderId) removeMermaidRenderArtifacts(renderId);
				if (cancelled || !hostRef.current) return;
				hostRef.current.innerHTML = '';
				paintedSourceRef.current = null;
				setPhase('error');
			}
		})();
		return () => {
			// Cancel in-flight work only. Clearing innerHTML here caused a remount loop:
			// SVG insert → layout → parent re-render → cleanup wipe → mermaid.render again (~600ms).
			cancelled = true;
		};
	}, [debouncedSource, stableId, palette, cacheId]);

	if (phase === 'error') {
		return (
			<div className="space-y-1.5">
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'leading-snug text-amber-200/90'
					)}
				>
					{t('mermaidErrorIntro', { lang: t('mermaidLangLabel') })}
				</p>
				<pre
					className={cn(
						'overflow-x-auto p-2.5 text-xs leading-relaxed text-[rgb(var(--desktop-accent-rgb)/0.9)]',
						'whitespace-pre-wrap wrap-break-word rounded-md border border-white/10 bg-black/40'
					)}
				>
					{debouncedSource}
				</pre>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'rounded-b-md pb-1.5 pt-1',
				resolvedSize === 'fullscreen'
					? 'w-full min-w-0 overflow-visible py-0'
					: 'overflow-x-auto',
				phase === 'loading' &&
					cn('min-h-14 text-(--desktop-text-dim)', DESKTOP_TYPOGRAPHY.small)
			)}
		>
			{phase === 'loading' ? (
				<span className="inline-block py-2" aria-live="polite">
					{t('mermaidLoading')}
				</span>
			) : null}
			<div
				ref={hostRef}
				className={cn(
					'mermaid-host',
					'[&_svg]:isolate [&_svg]:overflow-visible',
					'[&_svg_foreignObject]:overflow-visible [&_svg_foreignObject_div]:box-border [&_svg_foreignObject_div]:leading-snug [&_svg_foreignObject_div]:max-w-none!',
					'[&_svg_.nodeLabel_p]:m-0! [&_svg_.nodeLabel]:whitespace-normal!',
					isPaper
						? cn(
								'text-[#1c2430]',
								'[&_svg_foreignObject_*]:text-[#1c2430]!',
								'[&_svg_text]:fill-[#1c2430]',
								'[&_svg_.nodeLabel]:text-[#1c2430]! [&_svg_.nodeLabel_*]:text-inherit!',
								'[&_svg_.edgeLabel]:text-[#3d4654]! [&_svg_.edgeLabel_*]:text-inherit!'
							)
						: cn(
								'text-(--desktop-text-primary)',
								'[&_svg_foreignObject_*]:text-(--desktop-text-primary)!',
								'[&_svg_text]:fill-(--desktop-text-primary)',
								'[&_svg_.nodeLabel]:text-(--desktop-text-primary)! [&_svg_.nodeLabel_*]:text-inherit!',
								'[&_svg_.edgeLabel]:text-(--desktop-text-secondary)! [&_svg_.edgeLabel_*]:text-inherit!'
							),
					resolvedSize === 'fullscreen'
						? 'w-max min-w-full max-w-none [&_svg]:block [&_svg]:h-auto [&_svg]:w-auto! [&_svg]:max-w-none!'
						: resolvedSize === 'document'
							? DESKTOP_TYPOGRAPHY.mermaidSvgDocumentFit
							: DESKTOP_TYPOGRAPHY.mermaidSvgEmbeddedClamp
				)}
				role="img"
				aria-label={t('mermaidDiagramAria')}
				aria-busy={phase === 'loading'}
			/>
		</div>
	);
});

/** Превью в пузыре + полноэкранная модалка по кнопке. */
export const MermaidFenceBlock = React.memo(function MermaidFenceBlock({
	source,
	presentation = 'chat',
}: {
	source: string;
	/**
	 * `chat` — компактный превью в пузыре (max-height + SVG clamp).
	 * `document` — long-read: fit column width, readable labels, moderate height
	 *   (not native fullscreen SVG size).
	 */
	presentation?: 'chat' | 'document';
}) {
	const { t } = useTranslation('desktopAiChat');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const shellTheme = useDesktopShellTheme();
	const [modalOpen, setModalOpen] = React.useState(false);
	const dialogRef = React.useRef<HTMLDivElement>(null);
	const isDocument = presentation === 'document';
	const diagramPalette: MermaidPalette = isDocument
		? 'paper-light'
		: 'soft-dark';
	const ganttParsed = React.useMemo(() => {
		if (!isMermaidGanttSource(source)) return null;
		return parseMermaidGantt(source);
	}, [source]);
	const flowchartParsed = React.useMemo(() => {
		if (ganttParsed) return null;
		if (!isMermaidFlowchartSource(source)) return null;
		return parseMermaidFlowchart(source);
	}, [source, ganttParsed]);
	const sequenceParsed = React.useMemo(() => {
		if (ganttParsed || flowchartParsed) return null;
		if (!isMermaidSequenceSource(source)) return null;
		return parseMermaidSequence(source);
	}, [source, ganttParsed, flowchartParsed]);

	React.useEffect(() => {
		if (!modalOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setModalOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [modalOpen]);

	React.useEffect(() => {
		if (!modalOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	}, [modalOpen]);

	React.useEffect(() => {
		if (!modalOpen) return;
		const id = window.requestAnimationFrame(() => {
			dialogRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [modalOpen]);

	const portalShell = React.useMemo(
		() => (modalOpen ? getDesktopPortalShellProps() : null),
		[modalOpen]
	);

	const modal =
		modalOpen && typeof document !== 'undefined' ? (
			<ShellPortalMount layer="embedded_modal_backdrop">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby="desktop-ai-mermaid-modal-title"
					aria-describedby="desktop-ai-mermaid-modal-hint"
					tabIndex={-1}
					style={{
						...(portalShell?.style ?? {}),
						zIndex:
							portalStackBase +
							DESKTOP_PORTAL_STACK_BUMP.MERMAID_FULLSCREEN_MODAL,
					}}
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.modalBackdrop,
						'p-3 sm:p-5 md:p-8 outline-none text-(--desktop-text-primary)',
						portalShell?.theme === 'dark' && 'dark'
					)}
					onClick={(e) => {
						if (e.target === e.currentTarget) setModalOpen(false);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Escape') setModalOpen(false);
					}}
				>
					<div
						className={cn(
							'flex h-[min(92dvh,1400px)] w-full max-w-[min(96vw,1680px)] min-w-0 flex-col overflow-hidden',
							'rounded-(--desktop-radius-xl) border-2 border-(--desktop-border-strong)',
							'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_90%,rgb(6,7,12)_10%)]',
							'backdrop-blur-xl shadow-[0_40px_100px_rgba(0,0,0,0.78)]'
						)}
					>
						<header
							className={cn(
								'flex shrink-0 items-start justify-between gap-3 border-b border-(--desktop-border-subtle)',
								'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_35%,transparent)] px-4 py-3 md:px-5',
								'backdrop-blur-md'
							)}
						>
							<div className="min-w-0 flex-1 space-y-1">
								<span
									id="desktop-ai-mermaid-modal-title"
									className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight text-(--desktop-text-primary) antialiased"
								>
									<span
										className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-linear-to-br from-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.35)_100%,var(--desktop-surface-panel-strong))] to-black/50 text-[rgb(var(--desktop-accent-rgb)/0.95)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
										aria-hidden
									>
										<GlobeAltIcon className="size-4.5" />
									</span>
									{t('mermaidModalTitle')}
								</span>
								<p
									id="desktop-ai-mermaid-modal-hint"
									className={cn(
										'max-w-4xl leading-snug text-(--desktop-text-dim)',
										DESKTOP_TYPOGRAPHY.captionInherit
									)}
								>
									{t('mermaidModalHint')}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setModalOpen(false)}
								className={cn(
									'inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--desktop-border-subtle) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
									DESKTOP_INTERACTIVE.btnRounded,
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								aria-label={t('closeLabel')}
							>
								<XMarkIcon className="size-5" aria-hidden />
							</button>
						</header>
						<div
							className={cn(
								'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
								'bg-[linear-gradient(180deg,rgb(0_0_0/0.28)_0%,rgb(var(--desktop-bg-secondary-rgb)/0.06)_100%)]'
							)}
						>
							<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 md:px-6 md:py-5">
								<section
									aria-label={t('mermaidDiagramAria')}
									className={cn(
										'rounded-xl border p-3 sm:p-5 md:p-6',
										isDocument
											? 'border-[#c5ced9] bg-[#eef1f5] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]'
											: cn(
													'border-white/9',
													'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_14%,rgb(0,0,0)_86%)]',
													'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
												)
									)}
								>
									<div
										className={cn(
											'w-full min-w-0 overflow-x-auto',
											'scrollbar-thin',
											'[scrollbar-color:rgb(139_92_246/0.45)_rgb(0_0_0/0.2)]'
										)}
									>
										<ChatMermaidBlock
											source={source}
											size="fullscreen"
											palette={diagramPalette}
										/>
									</div>
								</section>
							</div>
						</div>
					</div>
				</div>
			</ShellPortalMount>
		) : null;

	if (ganttParsed) {
		return (
			<RoadmapTimeline
				data={ganttParsed}
				density={isDocument ? 'comfortable' : 'compact'}
			/>
		);
	}

	if (flowchartParsed) {
		return (
			<ProcessFlow
				data={flowchartParsed}
				density={isDocument ? 'comfortable' : 'compact'}
			/>
		);
	}

	if (sequenceParsed) {
		return (
			<SequenceFlow
				data={sequenceParsed}
				density={isDocument ? 'comfortable' : 'compact'}
			/>
		);
	}

	return (
		<>
			<figure
				className={cn(
					'min-w-0 max-w-full overflow-hidden',
					isDocument
						? 'my-4 rounded-(--desktop-radius-lg) border border-[#c5ced9] bg-[#eef1f5] shadow-sm'
						: cn(
								'my-2.5 rounded-lg border',
								shellTheme === 'light'
									? 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-[0_6px_24px_rgba(0,0,0,0.08)]'
									: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_72%,rgb(var(--desktop-bg-primary-rgb))_28%)] shadow-[0_8px_28px_rgba(0,0,0,0.22)]'
							)
				)}
			>
				<div
					className={cn(
						'flex items-center justify-between gap-1.5 border-b',
						isDocument
							? 'border-[#d5dde6] bg-[#f5f7fa] px-3 py-1.5'
							: cn(
									'px-2.5 py-1',
									shellTheme === 'light'
										? 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
										: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_48%,rgb(var(--desktop-bg-primary-rgb))_52%)]'
								)
					)}
				>
					<span
						className={cn(
							'inline-flex min-w-0 items-center gap-1.5 leading-tight',
							isDocument
								? 'text-[11px] font-medium tracking-wide uppercase text-[#5c6778]'
								: cn('text-(--desktop-text-dim)', DESKTOP_TYPOGRAPHY.small)
						)}
					>
						<GlobeAltIcon
							className={cn(
								'shrink-0 opacity-75',
								isDocument ? 'size-3.5' : 'size-3'
							)}
							aria-hidden
						/>
						<span className="truncate">{t('mermaidFenceLabel')}</span>
					</span>
					<button
						type="button"
						onClick={() => setModalOpen(true)}
						className={cn(
							'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium',
							DESKTOP_TYPOGRAPHY.shellMeta10,
							isDocument
								? 'border-[#8aa0bc]/70 bg-white text-[#2f5f94] hover:bg-[#e8eef6]'
								: shellTheme === 'light'
									? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb))] hover:bg-[rgb(var(--desktop-accent-rgb)/0.18)]'
									: 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)] text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.22)_100%,transparent)] hover:border-[rgb(var(--desktop-accent-rgb)/0.45)]',
							DESKTOP_INTERACTIVE.btnRounded
						)}
					>
						<ArrowsPointingOutIcon className="size-3" aria-hidden />
						{t('mermaidExpand')}
					</button>
				</div>
				<div
					className={cn(
						'overflow-x-auto overflow-y-auto',
						isDocument ? 'max-h-[min(22rem,48vh)]' : 'max-h-65'
					)}
				>
					<div
						className={cn(
							isDocument ? 'px-2.5 pb-2.5 pt-1.5 sm:px-3' : 'px-1.5 pb-1'
						)}
					>
						<ChatMermaidBlock
							source={source}
							size={isDocument ? 'document' : 'chat'}
							palette={diagramPalette}
						/>
					</div>
				</div>
			</figure>
			{modal}
		</>
	);
});
