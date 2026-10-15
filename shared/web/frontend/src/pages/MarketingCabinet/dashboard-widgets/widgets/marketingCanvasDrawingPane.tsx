/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hosts the Marketing dashboard Excalidraw widget and persists compact scene snapshots
 * under `marketingCanvasPersistKey` for fast restore/export.
 *
 * Invariants:
 * - Legacy tldraw payloads must never crash restore and are treated as empty Excalidraw scene.
 * - Debounced persist timer is cleared on unmount so stale callbacks do not write after tab switch.
 *
 * Related:
 * - src/pages/MarketingCabinet/dashboard-widgets/widgets/marketingCanvasPersistKey.ts
 */
import {
	Excalidraw,
	exportToBlob,
	exportToSvg,
	serializeAsJSON,
	restore,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import * as React from 'react';

import { cn } from '@/utils/cn';
import { marketingCanvasPersistKey } from './marketingCanvasPersistKey';

type MarketingExcalidrawApi = Parameters<
	NonNullable<React.ComponentProps<typeof Excalidraw>['excalidrawAPI']>
>[0];
type MarketingExcalidrawOnChange = NonNullable<
	React.ComponentProps<typeof Excalidraw>['onChange']
>;

const DEBOUNCE_MS = 500;
/** Raster/SVG export cap — avoid browser OOM and huge downloads (G.67). */
const MAX_EXPORT_IMAGE_BYTES = 12 * 1024 * 1024;

export type MarketingCanvasDrawingPaneHandle = {
	flushSnapshot: () => Record<string, unknown> | null;
	exportPng: (basename: string) => Promise<void>;
	exportSvg: (basename: string) => Promise<void>;
};

export type MarketingCanvasDrawingPaneProps = {
	widgetId: string;
	remountKey?: number;
	initialSnapshot: Record<string, unknown> | undefined;
	readOnly: boolean;
	onPersist: (snapshot: Record<string, unknown>) => void;
	onLocalEdit?: () => void;
	className?: string;
};

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	a.click();
	URL.revokeObjectURL(url);
}

function legacyTldrawShapeCount(snapshot: Record<string, unknown>): number {
	try {
		const doc = snapshot.document as
			| { records?: Record<string, { typeName?: string }> }
			| undefined;
		const records = doc?.records;
		if (!records || typeof records !== 'object') {
			return 0;
		}
		let n = 0;
		for (const rec of Object.values(records)) {
			if (rec && typeof rec === 'object' && rec.typeName === 'shape') {
				n += 1;
			}
		}
		return n;
	} catch {
		return 0;
	}
}

function normalizeInitial(snapshot: Record<string, unknown> | undefined): {
	elements: ReturnType<typeof restore>['elements'];
	appState: ReturnType<typeof restore>['appState'];
	files?: ReturnType<typeof restore>['files'];
} {
	if (!snapshot || typeof snapshot !== 'object') {
		return restore({ elements: [], appState: {} }, null, null, {
			repairBindings: true,
		});
	}
	const inner = snapshot[marketingCanvasPersistKey];
	if (
		inner &&
		typeof inner === 'object' &&
		!Array.isArray(inner) &&
		('elements' in inner || 'type' in inner)
	) {
		const blob = inner as {
			elements?: unknown;
			appState?: unknown;
			files?: unknown | null;
		};
		const base: {
			elements: never;
			appState: never;
			files?: never;
		} = {
			elements: ((blob.elements as never) ?? []) as never,
			appState: ((blob.appState as never) ?? {}) as never,
		};
		if (blob.files && typeof blob.files === 'object') {
			base.files = blob.files as never;
		}
		return restore(base, null, null, { repairBindings: true });
	}
	if (legacyTldrawShapeCount(snapshot) > 0) {
		return restore({ elements: [], appState: {} }, null, null, {
			repairBindings: true,
		});
	}
	return restore({ elements: [], appState: {} }, null, null, {
		repairBindings: true,
	});
}

/** Minimal subset of scene appState to shrink JSON vs full editor state */
function persistedAppSlice(
	api: MarketingExcalidrawApi | null
): Record<string, unknown> {
	const s = api?.getAppState();
	if (!s) {
		return {};
	}
	const out: Record<string, unknown> = {
		viewBackgroundColor: s.viewBackgroundColor,
		exportBackground: s.exportBackground,
		theme: s.theme,
	};
	if (typeof s.gridSize === 'number') {
		out.gridSize = s.gridSize;
	}
	return out;
}

function countNonDeletedElements(
	elements: readonly { isDeleted?: boolean }[]
): number {
	return elements.filter((e) => e && !(e as { isDeleted?: boolean }).isDeleted)
		.length;
}

export const MarketingCanvasDrawingPaneInner = React.forwardRef<
	MarketingCanvasDrawingPaneHandle,
	MarketingCanvasDrawingPaneProps
>(function MarketingCanvasDrawingPane(props, forwardedRef) {
	const {
		widgetId,
		remountKey = 0,
		readOnly,
		onPersist,
		onLocalEdit,
		className,
		initialSnapshot,
	} = props;
	const apiRef = React.useRef<MarketingExcalidrawApi | null>(null);
	const hydratedRef = React.useRef(false);
	const onPersistRef = React.useRef(onPersist);
	onPersistRef.current = onPersist;
	const onLocalEditRef = React.useRef(onLocalEdit);
	onLocalEditRef.current = onLocalEdit;
	const persistTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null
	);
	const normalized = React.useMemo(
		() => normalizeInitial(initialSnapshot),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- remount resets via key on wrapper if needed
		[initialSnapshot]
	);

	const exportRasterOrVector = React.useCallback(
		async (basename: string, format: 'png' | 'svg'): Promise<void> => {
			const api = apiRef.current;
			if (!api) {
				throw new Error('editor-not-ready');
			}
			const elements = api.getSceneElements();
			if (countNonDeletedElements(elements) === 0) {
				throw new Error('empty-canvas');
			}
			const appState = api.getAppState();
			const files = api.getFiles();

			const exportSlice = {
				...appState,
				exportBackground: true,
			} as Parameters<typeof exportToSvg>[0]['appState'];

			if (format === 'svg') {
				const svg = await exportToSvg({
					elements,
					appState: exportSlice,
					files,
					exportPadding: 12,
				});
				const text = svg.outerHTML;
				const encoder = new TextEncoder();
				if (encoder.encode(text).length <= MAX_EXPORT_IMAGE_BYTES) {
					downloadBlob(
						new Blob([text], { type: 'image/svg+xml' }),
						`${basename}.svg`
					);
					return;
				}
				throw new Error('export-too-large');
			}

			const scales: Array<{ scale: number; quality?: number }> = [
				{ scale: 1 },
				{ scale: 0.75 },
				{ scale: 0.5 },
			];
			for (const { scale } of scales) {
				const blob = await exportToBlob({
					elements,
					appState: exportSlice,
					files,
					mimeType: 'image/png',
					exportPadding: 12,
					getDimensions: (w, h) => ({
						width: Math.max(1, Math.round(w * scale)),
						height: Math.max(1, Math.round(h * scale)),
					}),
				});
				if (blob.size <= MAX_EXPORT_IMAGE_BYTES) {
					downloadBlob(blob, `${basename}.png`);
					return;
				}
			}
			throw new Error('export-too-large');
		},
		[]
	);

	React.useImperativeHandle(
		forwardedRef,
		() => ({
			flushSnapshot: () => {
				const api = apiRef.current;
				if (!api) {
					return null;
				}
				try {
					const els = api.getSceneElements();
					const files = api.getFiles();
					const appSlice = persistedAppSlice(api);
					const jsonStr = serializeAsJSON(
						els,
						appSlice as never,
						files,
						'database'
					);
					const parsedUnknown: unknown = JSON.parse(jsonStr) as unknown;
					return {
						[marketingCanvasPersistKey]: parsedUnknown,
					} as Record<string, unknown>;
				} catch {
					return null;
				}
			},
			exportPng: (basename: string) => exportRasterOrVector(basename, 'png'),
			exportSvg: (basename: string) => exportRasterOrVector(basename, 'svg'),
		}),
		[exportRasterOrVector]
	);

	React.useLayoutEffect(() => {
		// Re-arm hydration when server/local snapshot replacement changes scene input.
		void normalized.elements;
		void normalized.appState;
		hydratedRef.current = false;
		const id = window.requestAnimationFrame(() => {
			hydratedRef.current = true;
		});
		return () => window.cancelAnimationFrame(id);
	}, [normalized.elements, normalized.appState]);

	React.useEffect(
		() => () => {
			if (persistTimerRef.current !== null) {
				clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
			apiRef.current = null;
		},
		[]
	);

	const handleChange = React.useCallback<MarketingExcalidrawOnChange>(
		(_elements) => {
			if (readOnly) {
				return;
			}
			if (hydratedRef.current) {
				onLocalEditRef.current?.();
			}
			if (persistTimerRef.current !== null) {
				clearTimeout(persistTimerRef.current);
			}
			persistTimerRef.current = setTimeout(() => {
				persistTimerRef.current = null;
				const api = apiRef.current;
				if (!api) {
					return;
				}
				try {
					const els = api.getSceneElements();
					const files = api.getFiles();
					const jsonStr = serializeAsJSON(
						els,
						persistedAppSlice(api) as never,
						files,
						'database'
					);
					const parsedUnknown: unknown = JSON.parse(jsonStr) as unknown;
					onPersistRef.current({
						[marketingCanvasPersistKey]: parsedUnknown,
					});
				} catch {
					// ignore
				}
			}, DEBOUNCE_MS);
		},
		[readOnly]
	);

	const initialDataMemo = React.useMemo(
		() =>
			normalized.elements?.length ||
			normalized.appState?.viewBackgroundColor !== undefined ||
			Object.keys(normalized.files ?? {}).length > 0
				? {
						elements: normalized.elements ?? [],
						appState: normalized.appState ?? undefined,
						...(normalized.files && Object.keys(normalized.files).length
							? { files: normalized.files }
							: {}),
					}
				: undefined,
		[normalized.elements, normalized.appState, normalized.files]
	);

	return (
		<div
			key={remountKey}
			data-marketing-widget-id={widgetId}
			className={cn(
				'excal-host min-h-[240px] min-w-0 flex-1 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
				className
			)}
			style={{ height: 420 }}
		>
			<Excalidraw
				excalidrawAPI={(api) => {
					apiRef.current = api;
				}}
				initialData={initialDataMemo}
				viewModeEnabled={readOnly}
				onChange={handleChange}
				theme={normalized.appState?.theme === 'dark' ? 'dark' : 'light'}
			/>
			<style>{`
				.excal-host .excalidraw .mobile-misc-actions-container,
				.excal-host .excalidraw .App-toolbar .Stack button[title*="collab" i],
				.excal-host .excalidraw .App-toolbar-layer__github,
				.excal-host .excalidraw .HelpDialog,
				.excal-host .excalidraw .panelRow .buttonList button[aria-label*="github" i] {
					display: none !important;
				}
			`}</style>
		</div>
	);
});

MarketingCanvasDrawingPaneInner.displayName = 'MarketingCanvasDrawingPane';

/** @deprecated Prefer MarketingCanvasDrawingPane — kept for churn-free grep */
export type MarketingCanvasTldrawPaneHandle = MarketingCanvasDrawingPaneHandle;
export const MarketingCanvasTldrawPane = MarketingCanvasDrawingPaneInner;
export default MarketingCanvasDrawingPaneInner;
