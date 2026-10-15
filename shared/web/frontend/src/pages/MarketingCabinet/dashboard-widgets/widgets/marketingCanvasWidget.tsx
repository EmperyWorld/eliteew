import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { ImcResearchResultMarkdown } from '@/pages/MarketingCabinet/components/ImcResearchResultMarkdown';
import { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ArrowDownTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cabinetNotify } from '../../cabinetNotify';

import type { MarketingWidgetConfig } from '../../marketingCabinetApi';
import {
	clampMarketingCanvasDraftText,
	MAX_CANVAS_MARKDOWN_UTF8_BYTES,
	MAX_TLDRAW_SNAPSHOT_JSON_BYTES,
} from '../parseWidgetConfig';
import { setMarketingCanvasWidgetDraftState } from '../marketingCanvasDraftRegistry';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import type {
	MarketingCanvasContentMode,
	MarketingWidgetCanvasConfig,
} from '../types';

import {
	countTldrawPages,
	countTldrawShapeRecords,
	MAX_TLDRAW_PAGE_COUNT,
	MAX_TLDRAW_SHAPE_RECORDS,
} from '../drawingSnapshotMetrics';
import type { MarketingCanvasDrawingPaneHandle } from './marketingCanvasDrawingPane';

const MarketingCanvasDrawingPane = React.lazy(
	async () => import('./marketingCanvasDrawingPane')
);

const DEBOUNCE_MS = 500;
const SAVED_RESET_MS = 2800;
const BYTE_WARN_RATIO = 0.9;

function utf8ByteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}

function tldrawSnapshotUtf8Bytes(snapshot: Record<string, unknown>): number {
	return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

function sanitizeExportBasename(title: string): string {
	const t = title
		.trim()
		.replace(/[^\w\s-]+/g, '')
		.replace(/\s+/g, '-')
		.slice(0, 72);
	return t.length > 0 ? t : 'dashboard-notes';
}

function applyTemplate(current: string, templateBody: string): string {
	if (current.trim() === '') {
		return clampMarketingCanvasDraftText(templateBody);
	}
	return clampMarketingCanvasDraftText(`${current}\n\n${templateBody}`);
}

function wrapSelection(
	ta: HTMLTextAreaElement,
	applyNext: (next: string) => void,
	before: string,
	after: string,
	placeholderWhenEmpty: string
) {
	const start = ta.selectionStart;
	const end = ta.selectionEnd;
	const value = ta.value;
	const selected = value.slice(start, end);
	const middle = selected.length > 0 ? selected : placeholderWhenEmpty;
	const raw =
		value.slice(0, start) + before + middle + after + value.slice(end);
	const next = clampMarketingCanvasDraftText(raw);
	applyNext(next);
	requestAnimationFrame(() => {
		ta.focus();
		const insertLen = before.length + middle.length;
		const pos = Math.min(start + insertLen, next.length);
		ta.setSelectionRange(pos, pos);
	});
}

function insertLinePrefix(
	ta: HTMLTextAreaElement,
	applyNext: (next: string) => void,
	prefix: string
) {
	const start = ta.selectionStart;
	const v = ta.value;
	const lineStart = v.lastIndexOf('\n', start - 1) + 1;
	const lineEndIdx = v.indexOf('\n', start);
	const lineEnd = lineEndIdx === -1 ? v.length : lineEndIdx;
	const line = v.slice(lineStart, lineEnd);
	const newLine = line.startsWith(prefix) ? line : prefix + line;
	const raw = v.slice(0, lineStart) + newLine + v.slice(lineEnd);
	applyNext(clampMarketingCanvasDraftText(raw));
	requestAnimationFrame(() => {
		ta.focus();
		const pos = lineStart + newLine.length;
		ta.setSelectionRange(pos, pos);
	});
}

function CanvasDrawingLoadingSkeleton({
	t,
}: {
	t: MarketingDashboardWidgetBodyProps['t'];
}) {
	return (
		<div
			role="status"
			aria-busy="true"
			className={cn(
				'flex min-h-[200px] min-w-0 flex-col gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-3 motion-safe:animate-pulse',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			<div className="h-3 w-1/3 rounded bg-(--desktop-border-subtle)/60" />
			<div className="min-h-[120px] flex-1 rounded bg-(--desktop-border-subtle)/40" />
			<p className={cn('text-(--desktop-text-muted)', DESKTOP_TYPOGRAPHY.meta)}>
				{t('overview.dashboard.canvas.editorLoadingPlaceholder')}
			</p>
		</div>
	);
}

function MarketingCanvasReadonlyDrawingLazy(props: {
	widgetId: string;
	serverSnapshot: Record<string, unknown> | undefined;
	t: MarketingDashboardWidgetBodyProps['t'];
}) {
	const { widgetId, serverSnapshot, t } = props;
	const hostRef = React.useRef<HTMLDivElement>(null);
	const [visible, setVisible] = React.useState(false);
	React.useEffect(() => {
		const el = hostRef.current;
		if (!el) {
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					setVisible(true);
				}
			},
			{ root: null, rootMargin: '120px 0px', threshold: 0.01 }
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);
	const fallback = <CanvasDrawingLoadingSkeleton t={t} />;
	return (
		<div
			ref={hostRef}
			className={cn(
				'flex min-h-[200px] min-w-0 flex-1 flex-col',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			{visible ? (
				<React.Suspense fallback={fallback}>
					<MarketingCanvasDrawingPane
						widgetId={widgetId}
						remountKey={0}
						initialSnapshot={serverSnapshot}
						readOnly
						onPersist={() => {}}
					/>
				</React.Suspense>
			) : (
				fallback
			)}
		</div>
	);
}

export function MarketingCanvasWidget(
	props: MarketingDashboardWidgetBodyProps
) {
	const {
		projectId,
		widget,
		widgetConfig,
		allowMarketingWrite,
		onPersistWidgetConfig,
		extractApiErrorMessage,
		t,
	} = props;
	const { i18n } = useTranslation('marketing');
	const markdownLang = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language;
		if (lang.startsWith('ru')) {
			return 'ru';
		}
		const primary = lang.split('-')[0];
		return primary && primary.length >= 2 ? primary : 'en';
	}, [i18n.resolvedLanguage, i18n.language]);
	const cfg = widgetConfig as MarketingWidgetCanvasConfig;
	const serverMarkdown = cfg.canvasMarkdown ?? '';
	const serverContentMode: MarketingCanvasContentMode =
		cfg.canvasMode === 'drawing' ? 'drawing' : 'markdown';
	const serverSnapshot = cfg.tldrawSnapshot;

	const [contentMode, setContentMode] =
		React.useState<MarketingCanvasContentMode>(serverContentMode);
	const [draft, setDraft] = React.useState(serverMarkdown);
	const [mode, setMode] = React.useState<'edit' | 'preview'>('edit');
	const [saveStatus, setSaveStatus] = React.useState<
		'idle' | 'saving' | 'saved' | 'error'
	>('idle');
	const [saveError, setSaveError] = React.useState<string | null>(null);
	const [liveMessage, setLiveMessage] = React.useState('');
	const [liveSeq, setLiveSeq] = React.useState(0);
	const [markdownToolbarTemplateValue, setMarkdownToolbarTemplateValue] =
		React.useState('');
	const [drawingRemountKey, setDrawingRemountKey] = React.useState(0);

	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const drawingPaneRef = React.useRef<MarketingCanvasDrawingPaneHandle>(null);
	const draftRef = React.useRef(draft);
	draftRef.current = draft;
	const widgetRef = React.useRef(widget);
	widgetRef.current = widget;
	const serverMarkdownRef = React.useRef(serverMarkdown);
	serverMarkdownRef.current = serverMarkdown;
	const savedResetTimerRef = React.useRef<number | null>(null);
	const debounceTimerRef = React.useRef<number | null>(null);
	const persistRevisionRef = React.useRef(0);

	const onDrawingLocalEdit = React.useCallback(() => {
		if (!allowMarketingWrite) {
			return;
		}
		setMarketingCanvasWidgetDraftState(projectId, widget.id, true);
	}, [allowMarketingWrite, projectId, widget.id]);

	React.useEffect(() => {
		return () => {
			setMarketingCanvasWidgetDraftState(projectId, widget.id, false);
		};
	}, [projectId, widget.id]);

	React.useEffect(() => {
		if (!allowMarketingWrite || contentMode !== 'markdown') {
			return;
		}
		const dirty = draft !== serverMarkdown;
		setMarketingCanvasWidgetDraftState(projectId, widget.id, dirty);
	}, [
		allowMarketingWrite,
		contentMode,
		draft,
		serverMarkdown,
		projectId,
		widget.id,
	]);

	const markdownToolbarTemplateOptions = React.useMemo(
		() => [
			{ value: 'daily', label: t('overview.dashboard.canvas.templateDaily') },
			{
				value: 'checklist',
				label: t('overview.dashboard.canvas.templateChecklist'),
			},
		],
		[t]
	);

	const clearMarkdownDebounce = React.useCallback(() => {
		if (debounceTimerRef.current !== null) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
	}, []);

	const scheduleSavedReset = React.useCallback(() => {
		if (savedResetTimerRef.current) {
			clearTimeout(savedResetTimerRef.current);
		}
		savedResetTimerRef.current = window.setTimeout(() => {
			setSaveStatus('idle');
			savedResetTimerRef.current = null;
		}, SAVED_RESET_MS);
	}, []);

	const flushMarkdownPersist = React.useCallback(async () => {
		if (!allowMarketingWrite || !onPersistWidgetConfig) {
			return;
		}
		if (contentMode !== 'markdown') {
			return;
		}
		const toPersist = draftRef.current;
		if (toPersist === serverMarkdownRef.current) {
			return;
		}

		persistRevisionRef.current += 1;
		const myRev = persistRevisionRef.current;
		setSaveStatus('saving');
		setSaveError(null);
		try {
			await onPersistWidgetConfig({
				...(widgetRef.current.widget_config as MarketingWidgetConfig),
				canvasMarkdown: toPersist,
			});
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			setSaveStatus('saved');
			setLiveMessage(t('overview.dashboard.canvas.liveRegionSaved'));
			setLiveSeq((s) => s + 1);
			scheduleSavedReset();
			setMarketingCanvasWidgetDraftState(
				projectId,
				widgetRef.current.id,
				false
			);
		} catch (err) {
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			const fb = t('overview.dashboard.canvas.saveFailedFallback');
			const msg =
				extractApiErrorMessage?.(err, fb) ??
				(err instanceof Error ? err.message : fb);
			cabinetNotify.error(msg);
			setDraft(serverMarkdownRef.current);
			setSaveStatus('idle');
			setSaveError(null);
			setLiveMessage(t('overview.dashboard.canvas.autoRevertedAfterError'));
			setLiveSeq((s) => s + 1);
		}
	}, [
		allowMarketingWrite,
		contentMode,
		onPersistWidgetConfig,
		extractApiErrorMessage,
		t,
		scheduleSavedReset,
		projectId,
	]);

	const persistDrawingSnapshot = React.useCallback(
		async (snapshot: Record<string, unknown>) => {
			if (!allowMarketingWrite || !onPersistWidgetConfig) {
				return;
			}
			if (contentMode !== 'drawing') {
				return;
			}
			const shapeCount = countTldrawShapeRecords(snapshot);
			if (shapeCount > MAX_TLDRAW_SHAPE_RECORDS) {
				persistRevisionRef.current += 1;
				setSaveStatus('error');
				setSaveError(t('overview.dashboard.canvas.drawingTooComplex'));
				setLiveMessage(t('overview.dashboard.canvas.liveRegionFailed'));
				setLiveSeq((s) => s + 1);
				return;
			}
			const pageCount = countTldrawPages(snapshot);
			if (pageCount > MAX_TLDRAW_PAGE_COUNT) {
				persistRevisionRef.current += 1;
				setSaveStatus('error');
				setSaveError(
					t('overview.dashboard.canvas.drawingTooManyPages', {
						max: MAX_TLDRAW_PAGE_COUNT,
					})
				);
				setLiveMessage(t('overview.dashboard.canvas.liveRegionFailed'));
				setLiveSeq((s) => s + 1);
				return;
			}
			const bytes = tldrawSnapshotUtf8Bytes(snapshot);
			if (bytes > MAX_TLDRAW_SNAPSHOT_JSON_BYTES) {
				persistRevisionRef.current += 1;
				setSaveStatus('error');
				setSaveError(t('overview.dashboard.canvas.snapshotTooLarge'));
				setLiveMessage(t('overview.dashboard.canvas.liveRegionFailed'));
				setLiveSeq((s) => s + 1);
				return;
			}

			persistRevisionRef.current += 1;
			const myRev = persistRevisionRef.current;
			setSaveStatus('saving');
			setSaveError(null);
			try {
				await onPersistWidgetConfig({
					...(widgetRef.current.widget_config as MarketingWidgetConfig),
					canvasMode: 'drawing',
					tldrawSnapshot: snapshot,
				});
				if (myRev !== persistRevisionRef.current) {
					return;
				}
				setSaveStatus('saved');
				setLiveMessage(t('overview.dashboard.canvas.liveRegionSaved'));
				setLiveSeq((s) => s + 1);
				scheduleSavedReset();
				setMarketingCanvasWidgetDraftState(
					projectId,
					widgetRef.current.id,
					false
				);
			} catch (err) {
				if (myRev !== persistRevisionRef.current) {
					return;
				}
				const fb = t('overview.dashboard.canvas.saveFailedFallback');
				const msg =
					extractApiErrorMessage?.(err, fb) ??
					(err instanceof Error ? err.message : fb);
				cabinetNotify.error(msg);
				setDrawingRemountKey((k) => k + 1);
				setSaveStatus('idle');
				setSaveError(null);
				setLiveMessage(
					t('overview.dashboard.canvas.autoRevertedDrawingAfterError')
				);
				setLiveSeq((s) => s + 1);
			}
		},
		[
			allowMarketingWrite,
			contentMode,
			onPersistWidgetConfig,
			extractApiErrorMessage,
			t,
			scheduleSavedReset,
			projectId,
		]
	);

	React.useEffect(() => {
		setDraft(serverMarkdown);
	}, [serverMarkdown]);

	React.useEffect(() => {
		setContentMode(serverContentMode);
	}, [serverContentMode]);

	React.useEffect(() => {
		if (!allowMarketingWrite || !onPersistWidgetConfig) {
			return;
		}
		if (contentMode !== 'markdown') {
			return;
		}
		if (draft === serverMarkdown) {
			return;
		}
		clearMarkdownDebounce();
		debounceTimerRef.current = window.setTimeout(() => {
			debounceTimerRef.current = null;
			void flushMarkdownPersist();
		}, DEBOUNCE_MS);
		return () => {
			clearMarkdownDebounce();
		};
	}, [
		draft,
		serverMarkdown,
		contentMode,
		allowMarketingWrite,
		onPersistWidgetConfig,
		flushMarkdownPersist,
		clearMarkdownDebounce,
	]);

	React.useEffect(
		() => () => {
			clearMarkdownDebounce();
			if (savedResetTimerRef.current) {
				clearTimeout(savedResetTimerRef.current);
			}
		},
		[clearMarkdownDebounce]
	);

	const switchToDrawing = React.useCallback(async () => {
		if (
			!allowMarketingWrite ||
			!onPersistWidgetConfig ||
			contentMode === 'drawing'
		) {
			return;
		}
		clearMarkdownDebounce();
		persistRevisionRef.current += 1;
		const myRev = persistRevisionRef.current;
		setSaveStatus('saving');
		setSaveError(null);
		try {
			await onPersistWidgetConfig({
				...(widgetRef.current.widget_config as MarketingWidgetConfig),
				canvasMode: 'drawing',
				canvasMarkdown: clampMarketingCanvasDraftText(draftRef.current),
			});
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			setContentMode('drawing');
			setSaveStatus('saved');
			setLiveMessage(t('overview.dashboard.canvas.liveRegionSaved'));
			setLiveSeq((s) => s + 1);
			scheduleSavedReset();
		} catch (err) {
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			const fb = t('overview.dashboard.canvas.saveFailedFallback');
			const msg =
				extractApiErrorMessage?.(err, fb) ??
				(err instanceof Error ? err.message : fb);
			setSaveStatus('error');
			setSaveError(msg);
			setLiveMessage(t('overview.dashboard.canvas.liveRegionFailed'));
			setLiveSeq((s) => s + 1);
		}
	}, [
		allowMarketingWrite,
		contentMode,
		onPersistWidgetConfig,
		clearMarkdownDebounce,
		extractApiErrorMessage,
		t,
		scheduleSavedReset,
	]);

	const switchToMarkdown = React.useCallback(async () => {
		if (
			!allowMarketingWrite ||
			!onPersistWidgetConfig ||
			contentMode === 'markdown'
		) {
			return;
		}
		clearMarkdownDebounce();
		const snap = drawingPaneRef.current?.flushSnapshot() ?? undefined;
		persistRevisionRef.current += 1;
		const myRev = persistRevisionRef.current;
		setSaveStatus('saving');
		setSaveError(null);
		try {
			const payload: MarketingWidgetConfig = {
				...(widgetRef.current.widget_config as MarketingWidgetConfig),
				canvasMode: 'markdown',
			};
			if (snap !== undefined && Object.keys(snap).length > 0) {
				const bytes = tldrawSnapshotUtf8Bytes(snap);
				if (bytes > MAX_TLDRAW_SNAPSHOT_JSON_BYTES) {
					throw new Error(t('overview.dashboard.canvas.snapshotTooLarge'));
				}
				payload.tldrawSnapshot = snap;
			}
			await onPersistWidgetConfig(payload);
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			setContentMode('markdown');
			setSaveStatus('saved');
			setLiveMessage(t('overview.dashboard.canvas.liveRegionSaved'));
			setLiveSeq((s) => s + 1);
			scheduleSavedReset();
		} catch (err) {
			if (myRev !== persistRevisionRef.current) {
				return;
			}
			const fb = t('overview.dashboard.canvas.saveFailedFallback');
			const msg =
				extractApiErrorMessage?.(err, fb) ??
				(err instanceof Error ? err.message : fb);
			setSaveStatus('error');
			setSaveError(msg);
			setLiveMessage(t('overview.dashboard.canvas.liveRegionFailed'));
			setLiveSeq((s) => s + 1);
		}
	}, [
		allowMarketingWrite,
		contentMode,
		onPersistWidgetConfig,
		clearMarkdownDebounce,
		extractApiErrorMessage,
		t,
		scheduleSavedReset,
	]);

	const revertMarkdownToServer = React.useCallback(() => {
		if (saveStatus !== 'error') {
			return;
		}
		if (!window.confirm(t('overview.dashboard.canvas.revertToServerConfirm'))) {
			return;
		}
		clearMarkdownDebounce();
		persistRevisionRef.current += 1;
		const next = serverMarkdownRef.current;
		setDraft(next);
		setSaveStatus('idle');
		setSaveError(null);
		setLiveMessage(t('overview.dashboard.canvas.revertMarkdownLive'));
		setLiveSeq((s) => s + 1);
	}, [clearMarkdownDebounce, saveStatus, t]);

	const revertDrawingToServer = React.useCallback(() => {
		if (saveStatus !== 'error') {
			return;
		}
		if (!window.confirm(t('overview.dashboard.canvas.revertToServerConfirm'))) {
			return;
		}
		persistRevisionRef.current += 1;
		setSaveStatus('idle');
		setSaveError(null);
		setLiveMessage(t('overview.dashboard.canvas.revertDrawingLive'));
		setLiveSeq((s) => s + 1);
		setDrawingRemountKey((k) => k + 1);
	}, [saveStatus, t]);

	const exportDrawingPng = React.useCallback(async () => {
		const base = sanitizeExportBasename(widget.widget_title);
		const shortId = widget.id.replace(/-/g, '').slice(0, 8);
		const pane = drawingPaneRef.current;
		if (!pane) {
			cabinetNotify.info(t('overview.dashboard.canvas.exportDrawingEmpty'));
			return;
		}
		try {
			await pane.exportPng(`${base}-${shortId}`);
		} catch (e) {
			const code = e instanceof Error ? e.message : '';
			if (code === 'empty-canvas' || code === 'editor-not-ready') {
				cabinetNotify.info(t('overview.dashboard.canvas.exportDrawingEmpty'));
				return;
			}
			if (code === 'export-too-large') {
				cabinetNotify.error(
					t('overview.dashboard.canvas.exportDrawingTooLarge')
				);
				return;
			}
			cabinetNotify.error(t('overview.dashboard.canvas.exportDrawingFailed'));
		}
	}, [t, widget.id, widget.widget_title]);

	const exportDrawingSvg = React.useCallback(async () => {
		const base = sanitizeExportBasename(widget.widget_title);
		const shortId = widget.id.replace(/-/g, '').slice(0, 8);
		const pane = drawingPaneRef.current;
		if (!pane) {
			cabinetNotify.info(t('overview.dashboard.canvas.exportDrawingEmpty'));
			return;
		}
		try {
			await pane.exportSvg(`${base}-${shortId}`);
		} catch (e) {
			const code = e instanceof Error ? e.message : '';
			if (code === 'empty-canvas' || code === 'editor-not-ready') {
				cabinetNotify.info(t('overview.dashboard.canvas.exportDrawingEmpty'));
				return;
			}
			if (code === 'export-too-large') {
				cabinetNotify.error(
					t('overview.dashboard.canvas.exportDrawingTooLarge')
				);
				return;
			}
			cabinetNotify.error(t('overview.dashboard.canvas.exportDrawingFailed'));
		}
	}, [t, widget.id, widget.widget_title]);

	const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setDraft(clampMarketingCanvasDraftText(e.target.value));
		if (saveStatus === 'error') {
			setSaveStatus('idle');
			setSaveError(null);
		}
	};

	const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (!(e.metaKey || e.ctrlKey) || e.key !== 's') {
			return;
		}
		if (
			!allowMarketingWrite ||
			!onPersistWidgetConfig ||
			contentMode !== 'markdown'
		) {
			return;
		}
		e.preventDefault();
		clearMarkdownDebounce();
		void flushMarkdownPersist();
	};

	const applyDraft = (next: string) => {
		setDraft(next);
		if (saveStatus === 'error') {
			setSaveStatus('idle');
			setSaveError(null);
		}
	};

	const runWrap = (before: string, after: string, placeholder: string) => {
		const ta = textareaRef.current;
		if (!ta || mode !== 'edit') return;
		wrapSelection(ta, applyDraft, before, after, placeholder);
	};

	const exportMarkdown = () => {
		const base = sanitizeExportBasename(widget.widget_title);
		const shortId = widget.id.replace(/-/g, '').slice(0, 8);
		const name = `${base}-${shortId}.md`;
		const blob = new Blob([draft], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.rel = 'noopener';
		a.click();
		URL.revokeObjectURL(url);
	};

	const byteLen = utf8ByteLength(draft);
	const nearLimit = byteLen >= MAX_CANVAS_MARKDOWN_UTF8_BYTES * BYTE_WARN_RATIO;

	/* Read-only */
	if (!allowMarketingWrite) {
		if (serverContentMode === 'drawing') {
			const hasSnap = serverSnapshot && Object.keys(serverSnapshot).length > 0;
			if (!hasSnap) {
				return (
					<p
						className={cn(
							'px-1 text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.meta,
							MC_DASHBOARD_NO_DRAG_CLASS
						)}
					>
						{t('overview.dashboard.canvas.readOnlyDrawingEmpty')}
					</p>
				);
			}
			return (
				<MarketingCanvasReadonlyDrawingLazy
					widgetId={widget.id}
					serverSnapshot={serverSnapshot}
					t={t}
				/>
			);
		}

		if (!serverMarkdown.trim()) {
			return (
				<p
					className={cn(
						'px-1 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.meta,
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					{t('overview.dashboard.canvas.readOnlyEmpty')}
				</p>
			);
		}
		return (
			<div
				lang={markdownLang}
				className={cn('min-h-0 px-1', MC_DASHBOARD_NO_DRAG_CLASS)}
			>
				<ImcResearchResultMarkdown markdown={serverMarkdown} />
			</div>
		);
	}

	const showPreviewBody = draft.trim().length > 0;

	const saveStatusLabel =
		saveStatus === 'saving'
			? t('overview.dashboard.canvas.saveStatusSaving')
			: saveStatus === 'saved'
				? t('overview.dashboard.canvas.saveStatusSaved')
				: saveStatus === 'error' && saveError
					? saveError
					: null;

	if (contentMode === 'drawing') {
		return (
			<div
				className={cn(
					'flex min-h-0 flex-1 flex-col gap-2',
					MC_DASHBOARD_NO_DRAG_CLASS
				)}
			>
				<span className="sr-only" aria-live="polite">
					{liveMessage}
					<span aria-hidden>
						{'\u2060'}
						{liveSeq}
					</span>
				</span>
				<div
					className={cn(
						'flex flex-wrap items-center gap-1 gap-y-2',
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						className="h-8"
						onClick={switchToMarkdown}
					>
						{t('overview.dashboard.canvas.modeMarkdown')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="h-8"
					>
						{t('overview.dashboard.canvas.modeDrawing')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						className="h-8 min-h-9 shrink-0 px-2"
						aria-label={t('overview.dashboard.canvas.exportDrawingPngAria')}
						title={t('overview.dashboard.canvas.exportDrawingPng')}
						onClick={() => void exportDrawingPng()}
					>
						<ArrowDownTrayIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						className="h-8 min-h-9 shrink-0 px-2"
						aria-label={t('overview.dashboard.canvas.exportDrawingSvgAria')}
						title={t('overview.dashboard.canvas.exportDrawingSvg')}
						onClick={() => void exportDrawingSvg()}
					>
						<PhotoIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
					{saveStatus === 'error' ? (
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 shrink-0"
							onClick={revertDrawingToServer}
						>
							{t('overview.dashboard.canvas.revertToServer')}
						</DesktopAppButton>
					) : null}
					<span
						className={cn(
							'ml-1 min-w-0 flex-1 truncate text-xs',
							saveStatus === 'error'
								? 'text-(--mc-accent)'
								: 'text-(--desktop-text-muted)',
							DESKTOP_TYPOGRAPHY.meta
						)}
						title={
							saveStatus === 'error' ? (saveError ?? undefined) : undefined
						}
					>
						{saveStatusLabel}
					</span>
				</div>
				<React.Suspense fallback={<CanvasDrawingLoadingSkeleton t={t} />}>
					<MarketingCanvasDrawingPane
						ref={drawingPaneRef}
						widgetId={widget.id}
						remountKey={drawingRemountKey}
						initialSnapshot={serverSnapshot}
						readOnly={false}
						onPersist={persistDrawingSnapshot}
						onLocalEdit={onDrawingLocalEdit}
					/>
				</React.Suspense>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex min-h-0 flex-1 flex-col gap-2',
				MC_DASHBOARD_NO_DRAG_CLASS
			)}
		>
			<span className="sr-only" aria-live="polite">
				{liveMessage}
				<span aria-hidden>
					{'\u2060'}
					{liveSeq}
				</span>
			</span>
			<div
				className={cn(
					'flex flex-wrap items-center gap-1 gap-y-2',
					MC_DASHBOARD_NO_DRAG_CLASS
				)}
			>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					className="h-8"
				>
					{t('overview.dashboard.canvas.modeMarkdown')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					className="h-8"
					onClick={switchToDrawing}
				>
					{t('overview.dashboard.canvas.modeDrawing')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant={mode === 'edit' ? 'neutral' : 'ghost'}
					className="h-8"
					onClick={() => setMode('edit')}
				>
					{t('overview.dashboard.canvas.modeEdit')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					size="sm"
					variant={mode === 'preview' ? 'neutral' : 'ghost'}
					className="h-8"
					onClick={() => setMode('preview')}
				>
					{t('overview.dashboard.canvas.modePreview')}
				</DesktopAppButton>
				<span
					className={cn(
						'ml-1 min-w-0 flex-1 truncate text-xs',
						saveStatus === 'error'
							? 'text-(--mc-accent)'
							: 'text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.meta
					)}
					title={saveStatus === 'error' ? (saveError ?? undefined) : undefined}
				>
					{saveStatusLabel}
				</span>
				{saveStatus === 'error' ? (
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						className="h-8 shrink-0"
						onClick={revertMarkdownToServer}
					>
						{t('overview.dashboard.canvas.revertToServer')}
					</DesktopAppButton>
				) : null}
				<span
					className={cn(
						'shrink-0 text-xs tabular-nums',
						nearLimit ? 'text-(--mc-accent)' : 'text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.meta
					)}
				>
					{t('overview.dashboard.canvas.bytesCounter', {
						current: byteLen,
						max: MAX_CANVAS_MARKDOWN_UTF8_BYTES,
					})}
				</span>
			</div>

			{mode === 'edit' ? (
				<>
					<div
						className={cn(
							'flex flex-wrap items-center gap-1',
							MC_DASHBOARD_NO_DRAG_CLASS
						)}
					>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.toolbarBold')}
							onClick={() => runWrap('**', '**', 'text')}
						>
							<strong className="text-xs">B</strong>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.toolbarHeading')}
							onClick={() => runWrap('## ', '\n', 'Heading')}
						>
							<span className="text-xs font-semibold">H2</span>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.toolbarList')}
							onClick={() => {
								const ta = textareaRef.current;
								if (!ta) return;
								insertLinePrefix(ta, applyDraft, '- ');
							}}
						>
							<span className="text-xs" aria-hidden>
								•
							</span>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.toolbarCode')}
							onClick={() => runWrap('```\n', '\n```\n', 'code')}
						>
							<span className="font-mono text-xs">{'{}'}</span>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.toolbarLink')}
							onClick={() => runWrap('[', '](https://)', 'text')}
						>
							<span className="text-xs underline">URL</span>
						</DesktopAppButton>

						<div
							className={cn(
								'ml-1 flex min-w-0 items-center',
								MC_DASHBOARD_NO_DRAG_CLASS
							)}
						>
							<MarketingCabinetSelect
								size="compact"
								className="max-w-36 min-w-28"
								value={markdownToolbarTemplateValue}
								placeholderLabel={t('overview.dashboard.canvas.templatePick')}
								onChange={(v) => {
									if (v === 'daily') {
										setDraft(
											applyTemplate(
												draftRef.current,
												t('overview.dashboard.canvas.templateDailyBody')
											)
										);
									} else if (v === 'checklist') {
										setDraft(
											applyTemplate(
												draftRef.current,
												t('overview.dashboard.canvas.templateChecklistBody')
											)
										);
									}
									setMarkdownToolbarTemplateValue('');
								}}
								options={markdownToolbarTemplateOptions}
								aria-label={t('overview.dashboard.canvas.templatePick')}
							/>
						</div>

						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							className="h-8 min-h-8 px-2"
							title={t('overview.dashboard.canvas.exportMarkdown')}
							onClick={exportMarkdown}
						>
							<ArrowDownTrayIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</DesktopAppButton>
					</div>
					<textarea
						ref={textareaRef}
						spellCheck
						lang={markdownLang}
						className={cn(
							'min-h-[120px] flex-1 resize-y rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5 font-mono text-sm text-(--desktop-text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent)/40',
							MC_DASHBOARD_NO_DRAG_CLASS
						)}
						value={draft}
						onChange={onChange}
						onKeyDown={onTextareaKeyDown}
						placeholder={t('overview.dashboard.canvas.placeholder')}
						aria-label={t('overview.dashboard.canvas.editorLabel')}
						aria-busy={saveStatus === 'saving'}
						title={t('overview.dashboard.canvas.saveShortcutHint')}
					/>
				</>
			) : showPreviewBody ? (
				<div
					lang={markdownLang}
					className="min-h-0 flex-1 overflow-y-auto pr-0.5"
				>
					<ImcResearchResultMarkdown markdown={draft} />
				</div>
			) : (
				<p
					className={cn(
						'px-1 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.meta
					)}
				>
					{t('overview.dashboard.canvas.previewEmpty')}
				</p>
			)}
		</div>
	);
}
